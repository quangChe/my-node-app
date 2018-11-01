const mongoose = require('mongoose');
const requireLogin = require('../middlewares/requireLogin');

const Blog = mongoose.model('Blog');

module.exports = app => {
  app.get('/api/blogs/:id', requireLogin, async (req, res) => {
    const blog = await Blog.findOne({
      _user: req.user.id,
      _id: req.params.id
    });

    res.send(blog);
  });

  app.get('/api/blogs', requireLogin, async (req, res) => {
    // TODO: Move this out
    const redis = require('redis');
    const redisUrl = 'redis://127.0.0.1:6379';
    const client = redis.createClient(redisUrl);
    const util = require('util');
    client.get = util.promisify(client.get);

    // 1. Is there cached data in redis? 
    const cachedBlogs = await client.get(req.user.id);

    // - If yes, respond and return cached data right away: 
    if (cachedBlogs) {
      console.log('Serving from cache!');
      return res.send(JSON.parse(cachedBlogs));
    }

    // - If no, query MongoDB, respond to request, and update cache:
    const blogs = await Blog.find({ _user: req.user.id });
    console.log('Serving from MongoDB!');
    res.send(blogs);
    client.set(req.user.id, JSON.stringify(blogs));

    // TODO: Change prototype of MongoDB query to check the cache before
    // checking the database
  });

  app.post('/api/blogs', requireLogin, async (req, res) => {
    const { title, content } = req.body;

    const blog = new Blog({
      title,
      content,
      _user: req.user.id
    });

    try {
      await blog.save();
      res.send(blog);
    } catch (err) {
      res.send(400, err);
    }
  });
};
