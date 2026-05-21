const Category = require('../models/Category');

// POST /categories - Create category
exports.createCategory = async (req, res) => {
  try {
    const { name, level, parentId } = req.body;

    if (!name || !level) {
      return res.status(400).json({ status: 'fail', message: 'Name and level are required' });
    }

    // Validate level
    const validLevels = ['C1', 'C2', 'C3', 'C4'];
    if (!validLevels.includes(level)) {
      return res.status(400).json({ status: 'fail', message: 'Invalid level. Must be C1, C2, C3, or C4' });
    }

    // C1 categories cannot have a parent
    if (level === 'C1' && parentId) {
      return res.status(400).json({ status: 'fail', message: 'C1 categories cannot have a parent' });
    }

    // Non-C1 categories must have a parent
    if (level !== 'C1' && !parentId) {
      return res.status(400).json({ status: 'fail', message: 'Non-C1 categories must have a parent' });
    }

    let path = [];
    let pathString = name;
    let rootId = null;

    // If has parent, validate and build path
    if (parentId) {
      const parent = await Category.findById(parentId);
      if (!parent) {
        return res.status(400).json({ status: 'fail', message: 'Parent category not found' });
      }

      // Validate parent level
      const parentLevelIndex = validLevels.indexOf(parent.level);
      const childLevelIndex = validLevels.indexOf(level);
      if (childLevelIndex !== parentLevelIndex + 1) {
        return res.status(400).json({ status: 'fail', message: `Invalid hierarchy: ${level} cannot be child of ${parent.level}` });
      }

      path = [...parent.path, parent._id];
      pathString = `${parent.pathString} > ${name}`;
      rootId = parent.rootId || parent._id;
    }

    const category = await Category.create({
      name,
      level,
      parentId: parentId || null,
      rootId,
      path,
      pathString,
      createdBy: req.user._id
    });

    res.status(201).json({ status: 'success', data: category });
  } catch (err) {
    console.error('Create category error:', err);
    res.status(500).json({ status: 'fail', message: err.message });
  }
};

// GET /categories/tree - Get full category tree
exports.getCategoryTree = async (req, res) => {
  try {
    const categories = await Category.find({ isActive: true })
      .sort({ pathString: 1 })
      .lean();

    // Build tree structure
    const map = {};
    const roots = [];

    categories.forEach(cat => {
      map[cat._id] = { ...cat, children: [] };
    });

    categories.forEach(cat => {
      if (cat.parentId && map[cat.parentId]) {
        map[cat.parentId].children.push(map[cat._id]);
      } else {
        roots.push(map[cat._id]);
      }
    });

    res.status(200).json({ status: 'success', data: roots });
  } catch (err) {
    res.status(500).json({ status: 'fail', message: err.message });
  }
};

// GET /categories - List all categories
exports.getCategories = async (req, res) => {
  try {
    const { level, parentId, search } = req.query;
    const filter = { isActive: true };

    if (level) filter.level = level;
    if (parentId) filter.parentId = parentId;
    if (search) filter.name = { $regex: search, $options: 'i' };

    const categories = await Category.find(filter)
      .sort({ pathString: 1 })
      .lean();

    res.status(200).json({ status: 'success', data: categories });
  } catch (err) {
    res.status(500).json({ status: 'fail', message: err.message });
  }
};

// GET /categories/:id - Get single category
exports.getCategory = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id).lean();
    if (!category) {
      return res.status(404).json({ status: 'fail', message: 'Category not found' });
    }

    // Get children
    const children = await Category.find({ parentId: category._id, isActive: true }).lean();

    res.status(200).json({ status: 'success', data: { ...category, children } });
  } catch (err) {
    res.status(500).json({ status: 'fail', message: err.message });
  }
};

// GET /categories/:id/children - Get children of a category
exports.getChildren = async (req, res) => {
  try {
    const children = await Category.find({
      parentId: req.params.id,
      isActive: true
    }).sort({ name: 1 }).lean();

    res.status(200).json({ status: 'success', data: children });
  } catch (err) {
    res.status(500).json({ status: 'fail', message: err.message });
  }
};

// PUT /categories/:id - Update category
exports.updateCategory = async (req, res) => {
  try {
    const { name } = req.body;
    const category = await Category.findById(req.params.id);

    if (!category) {
      return res.status(404).json({ status: 'fail', message: 'Category not found' });
    }

    if (name) {
      // Update pathString for this category and all descendants
      const oldPathString = category.pathString;
      category.name = name;
      category.pathString = category.parentId
        ? `${(await Category.findById(category.parentId)).pathString} > ${name}`
        : name;

      await category.save();

      // Update all descendants' pathString
      const descendants = await Category.find({
        path: category._id
      });

      for (const desc of descendants) {
        desc.pathString = desc.pathString.replace(oldPathString, category.pathString);
        await desc.save();
      }
    }

    res.status(200).json({ status: 'success', data: category });
  } catch (err) {
    res.status(500).json({ status: 'fail', message: err.message });
  }
};

// DELETE /categories/:id - Soft delete category
exports.deleteCategory = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);

    if (!category) {
      return res.status(404).json({ status: 'fail', message: 'Category not found' });
    }

    // Check for children
    const children = await Category.find({ parentId: category._id, isActive: true });
    if (children.length > 0) {
      return res.status(400).json({ status: 'fail', message: 'Cannot delete category with children. Delete children first.' });
    }

    // Check for products
    const Product = require('../models/Product');
    const products = await Product.find({ categoryId: category._id, isActive: true });
    if (products.length > 0) {
      return res.status(400).json({ status: 'fail', message: 'Cannot delete category with products. Remove or reassign products first.' });
    }

    category.isActive = false;
    await category.save();

    res.status(200).json({ status: 'success', message: 'Category deleted' });
  } catch (err) {
    res.status(500).json({ status: 'fail', message: err.message });
  }
};

// GET /categories/leaves - Get all leaf categories (for product assignment)
exports.getLeafCategories = async (req, res) => {
  try {
    const allCategories = await Category.find({ isActive: true }).lean();

    // A leaf category has no children
    const parentIds = new Set(allCategories.filter(c => c.parentId).map(c => c.parentId.toString()));
    const leaves = allCategories.filter(c => !parentIds.has(c._id.toString()));

    res.status(200).json({ status: 'success', data: leaves });
  } catch (err) {
    res.status(500).json({ status: 'fail', message: err.message });
  }
};
