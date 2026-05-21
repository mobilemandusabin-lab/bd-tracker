const Product = require('../models/Product');
const Category = require('../models/Category');

// Helper: Resolve full category path and validate it's a leaf
async function resolveCategoryPath(categoryId) {
  const category = await Category.findById(categoryId);
  if (!category) {
    throw new Error('Category not found');
  }

  // Check if it's a leaf (no active children)
  const children = await Category.find({ parentId: categoryId, isActive: true });
  if (children.length > 0) {
    throw new Error('Products can only be assigned to leaf categories (no children)');
  }

  // Walk up the tree to build full path
  const pathCategories = [];
  let current = category;

  while (current) {
    pathCategories.unshift(current);
    if (current.parentId) {
      current = await Category.findById(current.parentId);
      if (!current) break;
    } else {
      current = null;
    }
  }

  // Build denormalized data
  const result = {
    categoryId: category._id,
    c1Id: null, c2Id: null, c3Id: null, c4Id: null,
    c1Name: null, c2Name: null, c3Name: null, c4Name: null,
    fullCategoryPath: category.pathString
  };

  pathCategories.forEach((cat, index) => {
    const levelIndex = index + 1;
    if (levelIndex === 1) { result.c1Id = cat._id; result.c1Name = cat.name; }
    if (levelIndex === 2) { result.c2Id = cat._id; result.c2Name = cat.name; }
    if (levelIndex === 3) { result.c3Id = cat._id; result.c3Name = cat.name; }
    if (levelIndex === 4) { result.c4Id = cat._id; result.c4Name = cat.name; }
  });

  return result;
}

// POST /products - Create product
exports.createProduct = async (req, res) => {
  try {
    const { name, sku, description, categoryId, price, vendorId, status } = req.body;

    if (!name || !categoryId) {
      return res.status(400).json({ status: 'fail', message: 'Name and categoryId are required' });
    }

    // Check SKU uniqueness
    if (sku) {
      const existing = await Product.findOne({ sku, isActive: true });
      if (existing) {
        return res.status(400).json({ status: 'fail', message: 'SKU already exists' });
      }
    }

    // Resolve and validate category
    const categoryData = await resolveCategoryPath(categoryId);

    const product = await Product.create({
      name,
      sku,
      description,
      categoryId,
      ...categoryData,
      price: price || 0,
      vendorId,
      status: status || 'active',
      createdBy: req.user._id
    });

    res.status(201).json({ status: 'success', data: product });
  } catch (err) {
    console.error('Create product error:', err);
    res.status(400).json({ status: 'fail', message: err.message });
  }
};

// GET /products - List products
exports.getProducts = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 25,
      search,
      categoryId,
      c1Id, c2Id, c3Id, c4Id,
      vendorId,
      status,
      sort = '-createdAt'
    } = req.query;

    const filter = { isActive: true };

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { sku: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    if (categoryId) filter.categoryId = categoryId;
    if (c1Id) filter.c1Id = c1Id;
    if (c2Id) filter.c2Id = c2Id;
    if (c3Id) filter.c3Id = c3Id;
    if (c4Id) filter.c4Id = c4Id;
    if (vendorId) filter.vendorId = vendorId;
    if (status) filter.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [products, total] = await Promise.all([
      Product.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .populate('categoryId', 'name level pathString')
        .populate('vendorId', 'business_name')
        .lean(),
      Product.countDocuments(filter)
    ]);

    res.status(200).json({
      status: 'success',
      data: products,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (err) {
    res.status(500).json({ status: 'fail', message: err.message });
  }
};

// GET /products/:id - Get single product
exports.getProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate('categoryId', 'name level pathString')
      .populate('vendorId', 'business_name')
      .lean();

    if (!product) {
      return res.status(404).json({ status: 'fail', message: 'Product not found' });
    }

    res.status(200).json({ status: 'success', data: product });
  } catch (err) {
    res.status(500).json({ status: 'fail', message: err.message });
  }
};

// PUT /products/:id - Update product
exports.updateProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ status: 'fail', message: 'Product not found' });
    }

    const { name, sku, description, categoryId, price, vendorId, status } = req.body;

    // If category changed, re-resolve
    if (categoryId && categoryId !== product.categoryId.toString()) {
      const categoryData = await resolveCategoryPath(categoryId);
      Object.assign(product, categoryData);
      product.categoryId = categoryId;
    }

    if (name) product.name = name;
    if (sku) {
      const existing = await Product.findOne({ sku, isActive: true, _id: { $ne: product._id } });
      if (existing) {
        return res.status(400).json({ status: 'fail', message: 'SKU already exists' });
      }
      product.sku = sku;
    }
    if (description !== undefined) product.description = description;
    if (price !== undefined) product.price = price;
    if (vendorId) product.vendorId = vendorId;
    if (status) product.status = status;

    await product.save();

    res.status(200).json({ status: 'success', data: product });
  } catch (err) {
    res.status(400).json({ status: 'fail', message: err.message });
  }
};

// DELETE /products/:id - Soft delete
exports.deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ status: 'fail', message: 'Product not found' });
    }

    product.isActive = false;
    await product.save();

    res.status(200).json({ status: 'success', message: 'Product deleted' });
  } catch (err) {
    res.status(500).json({ status: 'fail', message: err.message });
  }
};

// GET /products/stats/by-category - Category-wise product stats
exports.getProductsByCategory = async (req, res) => {
  try {
    const stats = await Product.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: { c1Id: '$c1Id', c1Name: '$c1Name' },
          totalProducts: { $sum: 1 },
          activeProducts: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
          totalQC: { $sum: '$qcStats.total' },
          passedQC: { $sum: '$qcStats.passed' },
          failedQC: { $sum: '$qcStats.failed' }
        }
      },
      { $sort: { totalProducts: -1 } }
    ]);

    res.status(200).json({ status: 'success', data: stats });
  } catch (err) {
    res.status(500).json({ status: 'fail', message: err.message });
  }
};
