const ChatSession = require('../models/ChatSession');
const { askQuestion } = require('../services/ragService');

exports.ask = async (req, res) => {
  try {
    const { question, sessionId } = req.body;
    if (!question || !question.trim()) {
      return res.status(400).json({ status: 'fail', message: 'Question is required' });
    }

    let session;
    if (sessionId) {
      session = await ChatSession.findOne({ _id: sessionId, user_id: req.user._id });
    }
    if (!session) {
      session = await ChatSession.create({
        user_id: req.user._id,
        title: question.substring(0, 60),
        messages: []
      });
    }

    const history = session.messages.map(m => ({ role: m.role, content: m.content }));

    const answer = await askQuestion({ question, history });

    session.messages.push(
      { role: 'user', content: question },
      { role: 'assistant', content: answer }
    );
    await session.save();

    if (session.title === 'New Chat' && session.messages.length >= 2) {
      const firstQ = session.messages[0]?.content || '';
      session.title = firstQ.length > 60 ? firstQ.substring(0, 57) + '...' : firstQ;
      await session.save();
    }

    res.status(200).json({
      status: 'success',
      data: {
        answer,
        sessionId: session._id,
        title: session.title
      }
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

exports.getSessions = async (req, res) => {
  try {
    const sessions = await ChatSession.find({ user_id: req.user._id })
      .select('title createdAt updatedAt messages')
      .sort({ updatedAt: -1 })
      .limit(30)
      .lean();

    const data = sessions.map(s => ({
      _id: s._id,
      title: s.title,
      messageCount: s.messages.length,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
      lastMessage: s.messages.length > 0 ? s.messages[s.messages.length - 1] : null
    }));

    res.status(200).json({ status: 'success', data });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

exports.getSession = async (req, res) => {
  try {
    const session = await ChatSession.findOne({
      _id: req.params.id,
      user_id: req.user._id
    }).lean();

    if (!session) {
      return res.status(404).json({ status: 'fail', message: 'Session not found' });
    }

    res.status(200).json({ status: 'success', data: session });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};

exports.deleteSession = async (req, res) => {
  try {
    const result = await ChatSession.deleteOne({
      _id: req.params.id,
      user_id: req.user._id
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({ status: 'fail', message: 'Session not found' });
    }

    res.status(200).json({ status: 'success', message: 'Session deleted' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
};
