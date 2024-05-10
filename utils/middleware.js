const { postSchema, commentSchema } = require("../schemas.js")
const ExpressError = require("./ExpressError")

const Comment = require("../models/comments");
const Post = require("../models/posts");


module.exports.isLoggedIn = (req, res, next) => {
    if (!req.isAuthenticated()) {
        req.flash("error", "you must be signed in")
        return res.redirect("/login")
    }
    next();
}

module.exports.validatePost = (req, res, next) => {

    const { error } = postSchema.validate(req.body);
    if (error) {
        const msg = error.details.map(el => el.message).join(",")
        throw new ExpressError(msg, 400)
    } else {
        next();
    }
}

module.exports.isauthor = async (req, res, next) => {
    const { id } = req.params;
    const post = await Post.findById(id)
    if (!post.author.equals(req.user._id)) {
        req.flash("error", "You do not have permission to do that!")
        return res.redirect(`/posts/${id}`);
    }
    next()
}

module.exports.validateComment = (req, res, next) => {
    const { error } = commentSchema.validate(req.body);

    if (error) {
        const msg = error.details.map(el => el.message).join(",")
        throw new ExpressError(msg, 400)
    } else {
        next();
    }
}

module.exports.isCommentAuthor = async (req, res, next) => {
    const { id, commentID } = req.params;
    const comment = await Comment.findById(commentID)
    if (!comment.author.equals(req.user._id)) {
        req.flash("error", "You do not have permission to do that!");
        return res.redirect(`/posts/${id}`)
    }
    next()
}