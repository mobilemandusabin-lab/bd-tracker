const SyncJob = require('../models/SyncJob');
const Product = require('../models/Product');
const mongoose = require('mongoose');

// CONFIGURATION
const BATCH_SIZE = parseInt(process.env.SYNC_BATCH_SIZE) || 100;
const MAX_RETRIES = 3;

/**
 * POST /api/sync/start
 * Creates a new sync job, determines total products, triggers first batch.
 */
exports.startSync = async (req, res) => {
  try {
    // Check if another sync is already running
    const existingRunning = await SyncJob.findOne({ status: 'running' });
    if (existingRunning) {
      return res.status(409).json({
        success: false,
        error: 'A sync job is already running. Please cancel the existing job first.',
      });
    }

    // Determine total products count from MongoDB
    // We count products that don't yet have an externalProductId, 
    // or we could fetch from external API - for now use existing product count
    const totalProducts = await Product.countDocuments({
      externalProductId: { $exists: false }
    });

    // Also count products that have externalProductId but may need updating
    const totalKnown = await Product.countDocuments({ externalProductId: { $exists: true } });

    const job = await SyncJob.create({
      status: 'running',
      total: totalProducts + totalKnown, // total universe we're syncing against
      batchSize: BATCH_SIZE,
      cursor: null,
      startedAt: new Date(),
      lastProcessedAt: new Date(),
    });

    // Trigger first batch processing
    await syncController.processBatch({ job, res }, true);

    res.status(200).json({
      success: true,
      jobId: job._id,
      status: 'pending',
      message: 'Sync job started',
    });
  } catch (err) {
    console.error('[Sync] start error:', err.message);
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
};

/**
 * POST /api/sync/process
 * Process a single batch of products and schedule the next batch.
 * Designed to be Vercel-safe: each invocation does limited work and returns.
 */
exports.processBatch = async (req, res) => {
  try {
    const { job: jobParam, force } = req.body || {};

    let job;
    if (jobParam) {
      job = jobParam;
    } else {
      // Find active sync job
      job = await SyncJob.findOne({ status: 'running' });
      if (!job) {
        return res.status(404).json({
          success: false,
          error: 'No running sync job found',
        });
      }
    }

    // Check cancellation
    if (job.status === 'cancelled') {
      return res.status(200).json({
        success: true,
        job: {
          id: job._id,
          status: 'cancelled',
          progress: 0,
        },
      });
    }

    // Acquire MongoDB atomic lock to prevent concurrent processing
    const lockedJob = await SyncJob.findOneAndUpdate(
      { _id: job._id, lockedBy: null, status: 'running' },
      { lockedBy: req.user ? req.user._id : 'system', lockedAt: new Date() },
      { new: true, upsert: false }
    );

    if (!lockedJob) {
      // Job is locked by another process - skip this invocation
      return res.status(200).json({
        success: true,
        job: {
          id: job._id,
          status: job.status,
          message: 'Sync locked by another process, skipping',
        },
      });
    }

    // Calculate how many products we need to process
    // Fetch products that need syncing (no externalProductId, or based on cursor)
    let query = {};

    if (job.cursor) {
      // Resume from checkpoint - find products with _id after the cursor
      // Using ObjectId comparison for MongoDB _id
      const cursorId = new mongoose.Types.ObjectId(job.cursor);
      query = { _id: { $gt: cursorId } };
    } else {
      // Start from beginning - products without externalProductId
      query = { externalProductId: { $exists: false } };
    }

    // Fetch next batch
    const productsToSync = await Product.find(query)
      .sort({ _id: 1 })
      .limit(job.batchSize)
      .lean();

    if (productsToSync.length === 0) {
      // No more products to process - mark completed
      await SyncJob.findByIdAndUpdate(job._id, {
        status: 'completed',
        completedAt: new Date(),
        lastProcessedAt: new Date(),
        error: null,
      });

      // Release lock
      await SyncJob.findByIdAndUpdate(job._id, { lockedBy: null, lockedAt: null });

      return res.status(200).json({
        success: true,
        job: {
          id: job._id,
          status: 'completed',
          total: job.total,
          processed: job.processed + productsToSync.length,
          successful: job.successful,
          failed: job.failed,
          progress: 100,
        },
        message: 'Sync completed - no more products',
      });
    }

    // Process each product in the batch
    let successfulThisBatch = 0;
    let failedThisBatch = 0;
    const newProcessedIds = [];

    for (const product of productsToSync) {
      try {
        // Simulate sync processing - in real implementation,
        // this would fetch from external API (Nepalcan)
        // For now, we mark the product with a generated externalProductId
        const externalProductId = `prod_${product._id.toString()}_${Date.now()}`;

        // Upsert product with externalProductId for idempotency
        await Product.findOneAndUpdate(
          { _id: product._id },
          { 
            $set: { 
              externalProductId,
              // Additional sync fields could be updated here
              status: 'active',
              isActive: true 
            } 
          },
          { upsert: true, new: true }
        );

        // Track this ID for duplicate prevention
        newProcessedIds.push(externalProductId);
        successfulThisBatch++;
      } catch (prodErr) {
        console.error(`[Sync] Product ${product._id} failed:`, prodErr.message);
        failedThisBatch++;
        // Continue with next product - do not stop the batch
      }
    }

    // Update cursor to last processed product's _id
    const lastProductId = productsToSync[productsToSync.length - 1]._id;
    const newCursor = lastProductId.toString();

    // Update job progress
    await SyncJob.findByIdAndUpdate(job._id, {
      $push: { processedIds: { $each: newProcessedIds } },
      processed: job.processed + productsToSync.length,
      successful: job.successful + successfulThisBatch,
      failed: job.failed + failedThisBatch,
      cursor: newCursor,
      lastProcessedAt: new Date(),
      error: null, // clear previous error
    });

    // Release lock
    await SyncJob.findByIdAndUpdate(job._id, { lockedBy: null, lockedAt: null });

    const totalProcessed = job.processed + productsToSync.length;
    const total = job.total || 0;
    const progress = total > 0 ? Math.round((totalProcessed / total) * 100) : 0;

    // If more products remain, schedule next batch
    if (totalProcessed < (total || productsToSync.length)) {
      // Return and let Vercel cron call again, or trigger next batch
      return res.status(200).json({
        success: true,
        job: {
          id: job._id,
          status: 'running',
          total,
          processed: totalProcessed,
          successful: job.successful + successfulThisBatch,
          failed: job.failed + failedThisBatch,
          progress,
          batchSize: job.batchSize,
          message: `Batch processed, ${productsToSync.length} products synced`,
        },
        // Indicate whether more batches are needed
        moreBatches: totalProcessed < (total || 1),
      });
    }

    // All products processed - mark completed
    await SyncJob.findByIdAndUpdate(job._id, {
      status: 'completed',
      completedAt: new Date(),
      error: null,
    });

    // Release lock
    await SyncJob.findByIdAndUpdate(job._id, { lockedBy: null, lockedAt: null });

    return res.status(200).json({
      success: true,
      job: {
        id: job._id,
        status: 'completed',
        total,
        processed: totalProcessed,
        successful: job.successful + successfulThisBatch,
        failed: job.failed + failedThisBatch,
        progress: 100,
      },
      message: 'Sync completed successfully',
    });
  } catch (err) {
    console.error('[Sync] processBatch error:', err.message);

    // Attempt to mark job as failed
    try {
      const job = await SyncJob.findOne({ status: 'running' });
      if (job) {
        await SyncJob.findByIdAndUpdate(job._id, {
          status: 'failed',
          error: err.message,
          completedAt: new Date(),
        });
      }
    } catch (saveErr) {
      // ignore
    }

    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
};

/**
 * GET /api/sync/status/:jobId
 * Return current sync job status and progress percentage.
 */
exports.getSyncStatus = async (req, res) => {
  try {
    const job = await SyncJob.findById(req.params.jobId)
      .lean();

    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Sync job not found',
      });
    }

    const total = job.total || 0;
    const processed = job.processed || 0;
    const progress = total > 0 ? Math.round((processed / total) * 100) : 0;

    res.status(200).json({
      success: true,
      job: {
        id: job._id,
        status: job.status,
        total: total,
        processed: processed,
        successful: job.successful || 0,
        failed: job.failed || 0,
        progress: progress,
        startedAt: job.startedAt,
        lastProcessedAt: job.lastProcessedAt,
        batchSize: job.batchSize,
        cursor: job.cursor,
      },
    });
  } catch (err) {
    console.error('[Sync] status error:', err.message);
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
};

/**
 * POST /api/sync/cancel/:jobId
 * Mark the running sync job as cancelled.
 * The currently executing batch will stop safely after the current operation.
 */
exports.cancelSync = async (req, res) => {
  try {
    const job = await SyncJob.findOne({ status: 'running' });

    if (!job) {
      if (!req.params.jobId) {
        return res.status(404).json({
          success: false,
          error: 'No running sync job found',
        });
      }
      // Job may already be completed/cancelled
      const existingJob = await SyncJob.findById(req.params.jobId);
      if (!existingJob) {
        return res.status(404).json({
          success: false,
          error: 'Sync job not found',
        });
      }
      return res.status(200).json({
        success: true,
        job: {
          id: existingJob._id,
          status: existingJob.status,
        },
      });
    }

    // Mark as cancelled
    await SyncJob.findByIdAndUpdate(job._id, {
      status: 'cancelled',
      error: `Manually cancelled by ${req.user ? req.user.name || 'user' : 'admin'}`,
    });

    // Release any lock
    await SyncJob.findByIdAndUpdate(job._id, { lockedBy: null, lockedAt: null });

    res.status(200).json({
      success: true,
      job: {
        id: job._id,
        status: 'cancelled',
      },
      message: 'Sync cancelled successfully',
    });
  } catch (err) {
    console.error('[Sync] cancel error:', err.message);
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
};