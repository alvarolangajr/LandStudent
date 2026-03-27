const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const methodOverride = require('method-override');
const bcrypt = require('bcryptjs');
const path = require('path');

const app = express();
const PORT = 3025;

console.log('LandStudent server file started');

// database
mongoose.connect('mongodb://127.0.0.1:27017/landstudent')
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.log(err));

// Models
const User = mongoose.model('User', {
  name: String,
  email: String,
  password: String,
  role: String
});

const Listing = mongoose.model('Listing', {
  title: String,
  description: String,
  price: Number,
  location: String,
  type: String,
  image: String,
  createdBy: String
});

// App config
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method'));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: 'secret123',
  resave: false,
  saveUninitialized: false
}));

app.use((req, res, next) => {
  res.locals.currentUser = req.session.user || null;
  next();
});

// Auth middleware
function isLoggedIn(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  next();
}

// Home
app.get('/', async (req, res) => {
  const listings = await Listing.find();
  res.render('home', { listings });
});

// Register
app.get('/register', (req, res) => {
  res.render('register', { error: '' });
});

app.post('/register', async (req, res) => {
  try {
    const existingUser = await User.findOne({ email: req.body.email });

    if (existingUser) {
      return res.render('register', {
        error: 'An account with this email already exists.'
      });
    }

    const hashed = await bcrypt.hash(req.body.password, 10);

    const user = new User({
      name: req.body.name,
      email: req.body.email,
      password: hashed,
      role: req.body.role
    });

    await user.save();
    req.session.user = user;
    res.redirect('/listings');
  } catch (err) {
    res.render('register', { error: 'Registration failed. Please try again.' });
  }
});

// Login
app.get('/login', (req, res) => {
  res.render('login', { error: '' });
});

app.post('/login', async (req, res) => {
  try {
    const user = await User.findOne({ email: req.body.email });

    if (!user) {
      return res.render('login', {
        error: 'No account found. Please register first.'
      });
    }

    const valid = await bcrypt.compare(req.body.password, user.password);

    if (!valid) {
      return res.render('login', {
        error: 'Registration details wrong.'
      });
    }

    req.session.user = user;
    res.redirect('/listings');
  } catch (err) {
    res.render('login', { error: 'Login failed. Please try again.' });
  }
});

// Logout
app.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

// Listings
app.get('/listings', async (req, res) => {
  const { location, maxPrice, type } = req.query;
  let filter = {};

  if (location) filter.location = new RegExp(location, 'i');
  if (maxPrice) filter.price = { $lte: Number(maxPrice) };
  if (type) filter.type = type;

  const listings = await Listing.find(filter);
  res.render('listings', { listings });
});

// Add listing page
app.get('/listings/new', isLoggedIn, (req, res) => {
  res.render('new-listing', { error: '' });
});

// Add listing
app.post('/listings', isLoggedIn, async (req, res) => {
  try {
    const listing = new Listing({
      title: req.body.title,
      description: req.body.description,
      price: req.body.price,
      location: req.body.location,
      type: req.body.type,
      image: req.body.image,
      createdBy: req.session.user._id
    });

    await listing.save();
    res.redirect('/listings');
  } catch (err) {
    res.render('new-listing', {
      error: 'Could not create listing.'
    });
  }
});

// Listing details
app.get('/listings/:id', async (req, res) => {
  const listing = await Listing.findById(req.params.id);
  res.render('listing-details', { listing });
});

// Dashboard
app.get('/dashboard', isLoggedIn, async (req, res) => {
  const myListings = await Listing.find({ createdBy: req.session.user._id });
  res.render('dashboard', { myListings });
});

// Delete listing
app.post('/listings/:id/delete', isLoggedIn, async (req, res) => {
  await Listing.findByIdAndDelete(req.params.id);
  res.redirect('/dashboard');
});

app.listen(PORT, () => {
  console.log(`LandStudent running on http://localhost:${PORT}`);
});