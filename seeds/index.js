const mongoose = require("mongoose");
const Post = require("../models/posts")

const dbUrl = process.env.MONGODB_URI || "mongodb://localhost:27017/blog"

mongoose.connect(dbUrl, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

const db = mongoose.connection;
db.on("error", console.error.bind(console, "connection error"))
db.once("open", () => {
    console.log("Database connected")
})

const seedDB = async () => {
    await Post.deleteMany({});

    const blog = new Post({
        author: "64162d1577b03ee4ad9b2d7a",
        title: "sample",

        description: "Lorem ipsum dolor sit amet consectetur adipisicing elit. Aut id accusantium quia. Itaque, perferendis expedita? Esse illum consectetur harum minus! Aspernatur ad officiis unde quaerat velit ea blanditiis quasi ipsum!"
    })
    await blog.save()
}


seedDB().then(() => {
    mongoose.connection.close()
})