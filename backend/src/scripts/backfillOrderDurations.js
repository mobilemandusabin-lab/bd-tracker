// One-time backfill: pre-compute processingDurationHours from statusHistory so
// the orders list endpoint never has to ship statusHistory.
//
// Usage: node src/scripts/backfillOrderDurations.js [--dry-run]
const path = require('path');
const mongoose = require('mongoose');
const NepalcanOrder = require('../models/NepalcanOrder');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const dryRun = process.argv.includes('--dry-run');

const durationPipeline = [
  {
    $set: {
      processingDurationHours: {
        $let: {
          vars: {
            history: {
              $sortArray: {
                input: { $ifNull: ['$statusHistory', []] },
                sortBy: { timestamp: 1 }
              }
            }
          },
          in: {
            $cond: [
              { $lt: [{ $size: '$$history' }, 2] },
              null,
              {
                $let: {
                  vars: {
                    diffMs: {
                      $subtract: [
                        { $toLong: { $arrayElemAt: ['$$history.timestamp', -1] } },
                        { $toLong: { $arrayElemAt: ['$$history.timestamp', 0] } }
                      ]
                    }
                  },
                  in: {
                    $cond: [
                      { $lte: ['$$diffMs', 0] },
                      0,
                      { $floor: { $divide: [{ $add: ['$$diffMs', 1800000] }, 3600000] } }
                    ]
                  }
                }
              }
            ]
          }
        }
      }
    }
  }
];

async function main() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is not set');

  await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 15000,
    family: 4
  });

  const total = await NepalcanOrder.countDocuments();
  console.log(`Orders: ${total}`);

  if (dryRun) {
    const sample = await NepalcanOrder.aggregate([
      { $limit: 5 },
      ...durationPipeline,
      { $project: { orderId: 1, processingDurationHours: 1, historyLength: { $size: { $ifNull: ['$statusHistory', []] } } } }
    ]);
    console.log('Dry run sample:', sample);
    return;
  }

  const result = await NepalcanOrder.updateMany({}, durationPipeline, { updatePipeline: true });
  console.log(`Matched ${result.matchedCount}, modified ${result.modifiedCount}`);

  const stillNull = await NepalcanOrder.countDocuments({ processingDurationHours: null });
  console.log(`processingDurationHours still null: ${stillNull}`);
}

main()
  .catch((error) => {
    console.error('Backfill failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
