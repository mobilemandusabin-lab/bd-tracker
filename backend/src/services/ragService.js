const OpenAI = require('openai');
const Lead = require('../models/Lead');
const NepalcanOrder = require('../models/NepalcanOrder');
const Activity = require('../models/Activity');
const Goal = require('../models/Goal');
const User = require('../models/User');

let groq = null;
function getGroq() {
  if (!groq) {
    groq = new OpenAI({
      baseURL: 'https://api.groq.com/openai/v1',
      apiKey: process.env.GROQ_API_KEY || 'sk-placeholder',
      timeout: 30 * 1000,
      maxRetries: 2
    });
  }
  return groq;
}

const MODEL = 'llama-3.3-70b-versatile';

function extractKeywords(question) {
  const stopWords = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
    'may', 'might', 'shall', 'can', 'need', 'dare', 'ought', 'used', 'to', 'of',
    'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during',
    'before', 'after', 'above', 'below', 'between', 'out', 'off', 'over', 'under',
    'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why',
    'how', 'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other', 'some',
    'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very',
    'just', 'because', 'but', 'and', 'or', 'if', 'while', 'about', 'up', 'what',
    'which', 'who', 'whom', 'this', 'that', 'these', 'those', 'it', 'its', 'me',
    'my', 'we', 'our', 'you', 'your', 'he', 'him', 'his', 'she', 'her', 'they',
    'them', 'their', 'show', 'tell', 'give', 'list', 'get', 'find', 'know', 'see',
    'like', 'want', 'need', 'please', 'help', 'me', 'can', 'could']);
  return question.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w));
}

function getDateRange(question) {
  const now = new Date();
  let start = new Date(0);
  let end = new Date(now);

  if (/today/i.test(question)) {
    start = new Date(now); start.setHours(0, 0, 0, 0);
    return { $gte: start, $lte: end };
  }
  if (/yesterday/i.test(question)) {
    start = new Date(now - 86400000); start.setHours(0, 0, 0, 0);
    end = new Date(now - 86400000); end.setHours(23, 59, 59, 999);
    return { $gte: start, $lte: end };
  }
  if (/this week/i.test(question)) {
    const day = now.getDay();
    start = new Date(now - day * 86400000); start.setHours(0, 0, 0, 0);
    return { $gte: start, $lte: end };
  }
  if (/this month/i.test(question)) {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { $gte: start, $lte: end };
  }
  if (/this (year|quarter)/i.test(question)) {
    start = new Date(now.getFullYear(), 0, 1);
    return { $gte: start, $lte: end };
  }
  if (/last month/i.test(question)) {
    start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    return { $gte: start, $lte: end };
  }
  if (/last week/i.test(question)) {
    const day = now.getDay();
    end = new Date(now - day * 86400000); end.setHours(23, 59, 59, 999);
    start = new Date(end - 7 * 86400000); start.setHours(0, 0, 0, 0);
    return { $gte: start, $lte: end };
  }
  if (/\d+ (days?|d)/i.test(question)) {
    const match = question.match(/(\d+)\s*(days?|d)/i);
    if (match) {
      start = new Date(now - parseInt(match[1]) * 86400000);
      return { $gte: start, $lte: end };
    }
  }
  return null;
}

async function searchLeads(question) {
  const keywords = extractKeywords(question);
  const dateFilter = getDateRange(question);
  const match = {};

  if (dateFilter) match.created_at = dateFilter;

  const statusKeywords = {
    'activated': 'Activated', 'active seller': 'Active Seller', 'active': 'Active Seller',
    'lost': 'Lost', 'new': 'New', 'contacted': 'Contacted', 'interested': 'Interested',
    'negotiation': 'Negotiation', 'verification': 'Verification', 'onboarding': 'Onboarding',
    'meeting': 'Meeting Scheduled', 'document': 'Document Pending', 'proposal': 'Proposal Dropped'
  };
  for (const [key, val] of Object.entries(statusKeywords)) {
    if (new RegExp(key, 'i').test(question)) {
      match.lead_status = val;
      break;
    }
  }

  if (/vendor/i.test(question)) match.type = 'vendor';
  if (/lead/i.test(question) && !match.type) match.type = 'lead';

  if (/assigned|bd|sabina|ram|shyam|john/i.test(question)) {
    const nameWords = question.split(/\s+/).filter(w => w.length > 2);
    const users = await User.find({
      $or: nameWords.map(w => ({ name: new RegExp(w, 'i') }))
    }).select('_id').lean();
    if (users.length) match.assigned_user = { $in: users.map(u => u._id) };
  }

  const results = await Lead.aggregate([
    { $match: match },
    { $sort: { created_at: -1 } },
    { $limit: 12 },
    { $lookup: { from: 'users', localField: 'assigned_user', foreignField: '_id', as: 'user' } },
    { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
    { $project: {
      business_name: 1, lead_status: 1, lead_source: 1, category: 1,
      type: 1, total_revenue: 1, delivered_order_count: 1, created_at: 1,
      assigned_user_name: { $ifNull: ['$user.name', 'Unassigned'] }
    }}
  ]);

  if (results.length > 0) return results;
  if (keywords.length === 0) return [];

  const textResults = await Lead.find(
    { $text: { $search: keywords.join(' ') } },
    { score: { $meta: 'textScore' } }
  ).sort({ score: { $meta: 'textScore' } }).limit(8).lean();

  return textResults.map(l => ({
    business_name: l.business_name, lead_status: l.lead_status,
    lead_source: l.lead_source, category: l.category,
    type: l.type, total_revenue: l.total_revenue || 0,
    delivered_order_count: l.delivered_order_count || 0,
    created_at: l.created_at, assigned_user_name: '—'
  }));
}

async function searchOrders(question) {
  const dateFilter = getDateRange(question);
  const match = {};
  if (dateFilter) match.createdAt = dateFilter;

  if (/delivered|cancelled|returned|pending|shipped|processing/i.test(question)) {
    const statuses = ['Delivered', 'Cancelled', 'Returned', 'Pending', 'Shipped', 'Processing'];
    for (const s of statuses) {
      if (new RegExp(s, 'i').test(question)) { match.orderStatus = s; break; }
    }
  }

  const results = await NepalcanOrder.aggregate([
    { $match: match },
    { $sort: { createdAt: -1 } },
    { $limit: 8 },
    { $project: { orderId: 1, vendor: 1, customer: 1, totalAmount: 1, orderStatus: 1, createdAt: 1, paymentMethod: 1 } }
  ]);

  if (results.length > 0 || extractKeywords(question).length === 0) return results;

  const words = extractKeywords(question);
  return await NepalcanOrder.find({
    $or: [
      { vendor: { $regex: words.join('|'), $options: 'i' } },
      { customer: { $regex: words.join('|'), $options: 'i' } }
    ]
  }).sort({ createdAt: -1 }).limit(8).lean();
}

async function searchActivities(question) {
  const dateFilter = getDateRange(question);
  const match = {};
  if (dateFilter) match.created_at = dateFilter;

  const words = extractKeywords(question);
  if (words.length > 0) {
    match.description = { $regex: words.join('|'), $options: 'i' };
  }

  return await Activity.aggregate([
    { $match: match },
    { $sort: { created_at: -1 } },
    { $limit: 8 },
    { $lookup: { from: 'leads', localField: 'lead_id', foreignField: '_id', as: 'lead' } },
    { $unwind: { path: '$lead', preserveNullAndEmptyArrays: true } },
    { $project: { description: 1, activity_type: 1, created_at: 1, business_name: '$lead.business_name', status: 1 } }
  ]);
}

async function searchGoals() {
  return await Goal.find({
    status: 'active',
    $or: [{ end_date: { $gte: new Date() } }, { end_date: null }]
  }).populate('assigned_to', 'name').lean();
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatContext(leads, orders, activities, goals, fallbackStats) {
  let context = '';

  if (leads.length > 0) {
    context += '=== LEADS / VENDORS ===\n';
    for (const l of leads) {
      context += `• ${l.business_name} | Type: ${l.type} | Status: ${l.lead_status} | Source: ${l.lead_source || '—'} | Category: ${l.category || '—'} | Assigned to: ${l.assigned_user_name || '—'} | Revenue: Rs.${(l.total_revenue || 0).toLocaleString()} | Orders: ${l.delivered_order_count || 0} | Created: ${formatDate(l.created_at)}\n`;
    }
    context += '\n';
  }

  if (orders.length > 0) {
    context += '=== ORDERS ===\n';
    for (const o of orders) {
      context += `• Order: ${o.orderId || '—'} | Vendor: ${o.vendor || '—'} | Customer: ${o.customer || '—'} | Amount: Rs.${(o.totalAmount || 0).toLocaleString()} | Status: ${o.orderStatus || '—'} | Payment: ${o.paymentMethod || '—'} | Date: ${formatDate(o.createdAt)}\n`;
    }
    context += '\n';
  }

  if (activities.length > 0) {
    context += '=== ACTIVITIES ===\n';
    for (const a of activities) {
      context += `• ${a.activity_type} | Vendor: ${a.business_name || '—'} | Note: ${(a.description || '').substring(0, 100)} | Status: ${a.status || '—'} | Date: ${formatDate(a.created_at)}\n`;
    }
    context += '\n';
  }

  if (goals.length > 0) {
    context += '=== ACTIVE GOALS ===\n';
    for (const g of goals) {
      context += `• Goal: ${g.name || g.unit || '—'} | Target: ${g.target_value || 0} | Unit: ${g.unit || '—'} | Assigned to: ${g.assigned_to?.name || '—'} | Period: ${formatDate(g.start_date)} → ${formatDate(g.end_date)}\n`;
    }
    context += '\n';
  }

  if (!context && fallbackStats) {
    const now = new Date();
    context = `No specific data found for this query. Current date: ${now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.\n`;
    context += `Quick stats: ${fallbackStats.totalLeads} total leads, ${fallbackStats.totalVendors} vendors, ${fallbackStats.activeSellers} active sellers, ${fallbackStats.totalOrders} orders.\n`;
  }

  return context;
}

async function buildContext(question) {
  const [leads, orders, activities, goals, fallbackStats] = await Promise.all([
    searchLeads(question),
    searchOrders(question),
    searchActivities(question),
    searchGoals(),
    (async () => {
      try {
        const [totalLeads, totalVendors, activeSellers, totalOrders] = await Promise.all([
          Lead.countDocuments(),
          Lead.countDocuments({ type: 'vendor' }),
          Lead.countDocuments({ lead_status: 'Active Seller' }),
          NepalcanOrder.countDocuments()
        ]);
        return { totalLeads, totalVendors, activeSellers, totalOrders };
      } catch (_) { return null; }
    })()
  ]);
  return formatContext(leads, orders, activities, goals, fallbackStats);
}

async function askQuestion({ question, history }) {
  const context = await buildContext(question);

  const systemPrompt = `You are a BD Tracker AI assistant embedded inside a business management app. Your role is to help users understand their data — leads, vendors, orders, activities, and goals.

RULES:
1. Answer ONLY based on the "Available data" section below. If the data doesn't contain enough information, say "I don't have that information in the available data" and suggest what they could check.
2. Be concise and specific. Use numbers, names, and statuses from the data.
3. If they ask for counts or summaries, calculate from the data provided.
4. Format responses with bullet points for lists.
5. Never make up data or guess.

Available data:
${context}`;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.slice(-10)
  ];

  try {
    const response = await getGroq().chat.completions.create({
      model: MODEL,
      messages,
      temperature: 0.3,
      max_tokens: 1024
    });

    return response.choices[0]?.message?.content || 'Sorry, I could not generate a response.';
  } catch (err) {
    console.error('[Groq] API error:', err.message);
    throw new Error(`AI service error: ${err.message}`);
  }
}

module.exports = { askQuestion };
