if (process.env.NODE_ENV !== "production") {
    require("dotenv").config();
}

const express = require("express")
const mongoose = require("mongoose")
const ejsMate = require("ejs-mate")
const path = require("path")
const Post = require("./models/posts")
const methodOverride = require("method-override")
const Comment = require("./models/comments")
const session = require("express-session");
const flash = require("connect-flash");
const passport = require("passport");
const localStratergy = require("passport-local");
const mongoSanitize = require("express-mongo-sanitize");
const MongoStore = require("connect-mongo")(session)
const helmet = require("helmet")
const User = require("./models/users")
const { isLoggedIn, isauthor, validatePost, validateComment, isCommentAuthor } = require("./utils/middleware")
const catchAsync = require("./utils/catchAsync")
const ExpressError = require("./utils/ExpressError");
const dbUrl = process.env.MONGODB_URI



mongoose.connect(dbUrl, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

const db = mongoose.connection;
db.on("error", console.error.bind(console, "connection error"))

db.once("open", () => {
    console.log("Database connected")
})

const app = express()

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"))

app.engine("ejs", ejsMate)
app.use(methodOverride("_method"));
app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true }))
app.use(mongoSanitize({
    replaceWith: "_"
}))


const secret = process.env.SECRET || "thisshouldbebettersecret"

const store = new MongoStore({
    url: dbUrl,
    secret,
    touchAfter: 24 * 60 * 60,
})

const sessionconfig = {
    store,
    name: "session",
    secret,
    resave: false,
    saveUninitialized: true,
    cookie: {
        httponly: true,
        // secure:true,
        expires: Date.now() + 1000 * 60 * 60 * 24 * 7,
        maxAge: 1000 * 60 * 60 * 24 * 7
    }
}


app.use(session(sessionconfig))
app.use(flash());


app.use((req, res, next) => {
    res.setHeader('Content-Security-Policy', "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:");
    next();
});

app.use(
    helmet.contentSecurityPolicy({
        useDefaults: false,
    }),
);

const scriptSrcUrls = [
    "https://cdn.jsdelivr.net/npm/bootstrap@5.2.2/",
    "https://stackpath.bootstrapcdn.com/",
    "https://kit.fontawesome.com/",
    "https://cdnjs.cloudflare.com/",
    "https://cdn.jsdelivr.net",
];
const styleSrcUrls = [
    "https://kit-free.fontawesome.com/",
    "https://cdn.jsdelivr.net/npm/bootstrap@5.2.2/",
    "https://stackpath.bootstrapcdn.com/",
    "https://use.fontawesome.com/",
    "https://fonts.googleapis.com",
    "https://fonts.gstatic.com"
];

const fontSrcUrls = ["https://fonts.googleapis.com",
    "https://fonts.gstatic.com"];
app.use(
    helmet.contentSecurityPolicy({
        directives: {
            defaultSrc: [],
            scriptSrc: ["'unsafe-inline'", "'self'", ...scriptSrcUrls],
            styleSrc: ["'self'", "'unsafe-inline'", ...styleSrcUrls],
            workerSrc: ["'self'", "blob:"],
            objectSrc: [],
            imgSrc: [
                "'self'",
                "blob:",
                "data:",
                "https://res.cloudinary.com/dyjzeodgl/image/upload/",
                "https://images.unsplash.com/",
            ],
            fontSrc: ["'self'", ...fontSrcUrls],
        },
    })
);

app.use(passport.initialize());
app.use(passport.session());
passport.use(new localStratergy(User.authenticate()));
passport.serializeUser(User.serializeUser())
passport.deserializeUser(User.deserializeUser());

app.use((req, res, next) => {
    res.locals.currentUser = req.user;
    res.locals.success = req.flash("success")
    res.locals.error = req.flash("error")
    next();
})


app.get("/register", (req, res) => {
    res.render("users/register")
})

app.post("/register", catchAsync(async (req, res) => {
    try {
        const { email, username, password } = req.body;
        const user = new User({ email, username })
        const registeredUser = await User.register(user, password)
        req.login(registeredUser, err => {
            if (err) return next(err);
            req.flash("success", "Welcome to Blog!")
            res.redirect("/posts")
        })

    } catch (e) {
        req.flash("error", e.message);
        res.redirect("/register")
    }
}))



app.get("/login", (req, res) => {
    res.render("users/login")
})

app.post("/login", passport.authenticate("local", { failureFlash: true, failureRedirect: "/login" }), async (req, res) => {
    req.flash("success", "Welcome back")
    const redirecturl = req.session.returnTo || "/posts";
    delete req.session.returnTo;
    res.redirect(redirecturl)
})

app.get("/logout", (req, res, next) => {
    req.logout(function (err) {
        if (err) { return next(err) }
        req.flash("success", "Goodbye")
        res.redirect("/posts");
    });
})

app.get("/", (req, res) => {
    res.render("home")
})

app.get("/posts", catchAsync(async (req, res) => {
    const posts = await Post.find({})
    res.render("posts/index", { posts })
}))
app.get("/posts/new", isLoggedIn, (req, res) => {
    res.render("posts/new")
})
app.get("/posts/:id", catchAsync(async (req, res) => {
    const post = await Post.findById(req.params.id).populate({
        path: "comments",
        populate: {
            path: "author"
        }
    }).populate("author");
    if (!post) {
        req.flash("error", "Cannot find that post!");
        return res.redirect("/posts")
    }
    res.render("posts/show", { post })
}))

app.post("/posts", isLoggedIn, validatePost, catchAsync(async (req, res) => {
    const post = new Post(req.body.post)
    post.author = req.user._id;
    await post.save()
    req.flash("success", "successfully made a new post");
    res.redirect(`/posts/${post._id}`)
}))

app.get("/posts/:id/edit", isLoggedIn, isauthor, catchAsync(async (req, res) => {
    const { id } = req.params
    const post = await Post.findById(id)
    if (!post) {
        req.flash("error", "Cannot find that post!");
        return res.redirect("/posts");
    }
    res.render("posts/edit", { post })
}))

app.put("/posts/:id", isLoggedIn, isauthor, validatePost, catchAsync(async (req, res) => {
    const { id } = req.params
    const post = await Post.findByIdAndUpdate(id, { ...req.body.post })
    await post.save()
    req.flash("success", "Successfully updated post!")
    res.redirect(`/posts/${post._id}`)
}))

app.delete("/posts/:id", isLoggedIn, isauthor, catchAsync(async (req, res) => {
    const { id } = req.params
    await Post.findByIdAndDelete(id)
    req.flash("success", "Successfully deleted a post!")
    res.redirect("/posts")
}))

app.post("/posts/:id/comments", isLoggedIn, validateComment, catchAsync(async (req, res) => {
    const post = await Post.findById(req.params.id);
    const comment = new Comment(req.body.comment)
    post.comments.push(comment)
    comment.author = req.user._id;
    await comment.save()
    await post.save()
    req.flash("success", "Created new comment!")
    res.redirect(`/posts/${post._id}/`)
}))

app.delete("/posts/:id/comments/:commentID", isLoggedIn, isCommentAuthor, catchAsync(async (req, res) => {
    const { id, commentID } = req.params
    await Post.findByIdAndUpdate(id, { $pull: { comments: commentID } })
    await Comment.findByIdAndDelete(req.params.commentID);
    req.flash("success", "Successfully deleted a comment!")
    res.redirect(`/posts/${id}`)
}))




app.all("*", (req, res, next) => {
    next(new ExpressError("Page not found", 404))
})

app.use((err, req, res, next) => {
    const { statusCode = 500 } = err;
    if (!err.message) message = "Something went wrong"
    res.status(statusCode).render("error", { err })
})

const port = process.env.PORT || 5000

app.listen(port, () => {
    console.log(`listening on port ${port}`)
})
