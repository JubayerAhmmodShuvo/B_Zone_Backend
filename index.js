const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());



mongoose.connect(
  "mongodb+srv://book_catalog:Lpb6OTXhWhRhR6WN@cluster0.ybq2s4f.mongodb.net/book_catalog?retryWrites=true&w=majority",
  {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  }
);
console.log("Connected to db");

const userSchema = new mongoose.Schema({
  email: String,
  password: String,
  wishlist: [{ type: mongoose.Schema.Types.ObjectId, ref: "Book" }],
  readingList: [{ type: mongoose.Schema.Types.ObjectId, ref: "Book" }],
});

const User = mongoose.model("User", userSchema);

const reviewSchema = new mongoose.Schema({
  comment: String,
  user: String,
});

const bookSchema = new mongoose.Schema({
  title: String,
  author: String,
  genre: String,
  publicationDate: Date,
  createdAt: {
    type: Date,
    default: Date.now,
  },
  reviews: [reviewSchema],
  user: String,
});

const Book = mongoose.model("Book", bookSchema);

const wishlistSchema = new mongoose.Schema({
  book: { type: mongoose.Schema.Types.ObjectId, ref: "Book" },
  user: { type: String },
});

const readingListSchema = new mongoose.Schema({
  book: { type: mongoose.Schema.Types.ObjectId, ref: "Book" },
  user: { type: String },
});

const Wishlist = mongoose.model("Wishlist", wishlistSchema);
const ReadingList = mongoose.model("ReadingList", readingListSchema);

const JWT_SECRET =
  "4df43b5abfd4eb739ed96cb864c1256efeeb47647a9a48b890daa64d2c020a7890f2e1e7fbd573180179ceee6bd02a1d9a8c0bb1a40a59c5f6d59bad777d7b61";

function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send({ error: "Unauthorized Access" });
  }
  const token = authHeader.split(" ")[1];
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).send({ error: "Forbidden" });
    }
    req.decoded = decoded;
    next();
  });
}

const generateToken = (user) => {
  const payload = {
    id: user.id,
    email: user.email,
  };

  return jwt.sign(payload, JWT_SECRET, { expiresIn: "3h" });
};

app.post("/api/signup", async (req, res) => {
  const { email, password, confirmPassword } = req.body;

  if (password !== confirmPassword) {
    return res.status(400).json({ message: "Passwords don't match" });
  }

  try {
    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(400).json({ message: "Email already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      email,
      password: hashedPassword,
    });

    await newUser.save();

    res.status(201).json({ message: "User registered successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = generateToken({ id: user._id });

    res.json({ email: user.email, token });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/api/books", async (req, res) => {
  try {
    const books = await Book.find();
    res.json(books);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/api/latest-books", async (req, res) => {
  try {
    const latestBooks = await Book.find().sort({ createdAt: -1 });
    res.json(latestBooks);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

app.post("/api/books", verifyJWT, async (req, res) => {
  try {
    const user = req.decoded.id;
    const { title, author, genre, publicationDate } = req.body;
    const newBook = new Book({
      title,
      author,
      genre,
      publicationDate,
      user,
    });

    const savedBook = await newBook.save();

    res.json(savedBook);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/api/books/:id", async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);
    if (book) {
      res.json(book);
    } else {
      res.status(404).json({ message: "Book not found" });
    }
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

app.delete("/api/books/:id", verifyJWT, async (req, res) => {
  try {
    const bookId = req.params.id;

    const bookToDelete = await Book.findById(bookId);

    if (!bookToDelete) {
      return res.status(404).json({ message: "Book not found" });
    }

    if (bookToDelete.user.toString() !== req.decoded.id) {
      return res
        .status(403)
        .json({ message: "Unauthorized - You cannot delete this book" });
    }

    await Wishlist.deleteMany({ book: bookToDelete._id });
    await ReadingList.deleteMany({ book: bookToDelete._id });

    await Book.findByIdAndDelete(bookId);

    res.json({ message: "Book deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

app.put("/api/books/:id", verifyJWT, async (req, res) => {
  try {
    const { title, author, genre, publicationDate } = req.body;
    const updatedBook = await Book.findById(req.params.id);

    if (!updatedBook) {
      return res.status(404).json({ message: "Book not found" });
    }

    if (updatedBook.user.toString() !== req.decoded.id) {
      return res
        .status(403)
        .json({ message: "Unauthorized - You cannot edit this book" });
    }

    updatedBook.title = title;
    updatedBook.author = author;
    updatedBook.genre = genre;
    updatedBook.publicationDate = publicationDate;

    const savedBook = await updatedBook.save();

    res.json(savedBook);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

app.post("/api/books/:id/reviews", verifyJWT, async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);
    if (!book) {
      return res.status(404).json({ message: "Book not found" });
    }

    const { comment, user } = req.body;
    const review = {
      comment,
      user,
    };

    book.reviews.push(review);
    const updatedBook = await book.save();
    res.json(updatedBook);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});
app.get("/api/books/:id/reviews", async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);
    if (!book) {
      return res.status(404).json({ message: "Book not found" });
    }

    res.json(book.reviews);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

app.post("/api/wishlist/:bookId", verifyJWT, async (req, res) => {
  try {
    const user = req.decoded.id;
    const { bookId } = req.params;

    const book = await Book.findById(bookId);

    if (!book) {
      return res.status(404).json({ message: "Book not found" });
    }

    const existingWishlistBook = await Wishlist.findOne({
      book: book._id,
      user,
    });
    if (existingWishlistBook) {
      return res.json({ message: "Book already exists in the wishlist" });
    }

    const newWishlistBook = new Wishlist({ book: book._id, user });
    await newWishlistBook.save();

    res.json({ message: "Book added to wishlist" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

app.post("/api/readinglist/:bookId", verifyJWT, async (req, res) => {
  try {
    const user = req.decoded.id;
    const { bookId } = req.params;
    const book = await Book.findById(bookId);

    if (!book) {
      return res.status(404).json({ message: "Book not found" });
    }

    const existingReadingListBook = await ReadingList.findOne({
      book: book._id,
    });
    if (existingReadingListBook) {
      return res.json({ message: "Book already exists in the reading list" });
    }

    const newReadingListBook = new ReadingList({ book: book._id, user });
    await newReadingListBook.save();

    res.json({ message: "Book added to reading list" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/api/wishlist", verifyJWT, async (req, res) => {
  try {
    const user = req.decoded.id;
    const wishlist = await Wishlist.find({ user }).populate("book");
    res.json(wishlist);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/api/readinglist", verifyJWT, async (req, res) => {
  try {
    const user = req.decoded.id;
    const readingList = await ReadingList.find({ user }).populate("book");
    res.json(readingList);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/", (req, res) => {
  res.send("Hello, this is the root URL!");
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
