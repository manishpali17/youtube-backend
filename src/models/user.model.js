import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import mongoose, { Schema } from "mongoose";
import { Comment } from "./comment.model.js";
import { Like } from "./like.model.js";
import { Subscription } from "./subscription.model.js";
import { Tweet } from "./tweet.model.js";
import { Video } from "./video.model.js";

const userSchema = new Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowecase: true,
      trim: true,
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    avatar: {
      type: String, // cloudinary url
      required: true,
    },
    coverImage: {
      type: String, // cloudinary url
    },
    watchHistory: [
      {
        type: Schema.Types.ObjectId,
        ref: "Video",
      },
    ],
    password: {
      type: String,
      required: [true, "Password is required"],
    },
    refreshToken: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

userSchema.pre("save", function (next) {
  if (!this.isModified("password")) return next();
  this.password = bcrypt.hashSync(this.password, 10);
  next();
});

userSchema.post("findOneAndDelete", async (user, next) => {
  try {
    if (user) {
      const userId = user._id;
      // Delete videos owned by the user

      const videoToDelete = await Video.find({ owner: userId });
      for (const video of videoToDelete) {
        const res = await Video.findOneAndDelete(video);
        console.log(res);
      }

      // Delete likes by the user
      await Like.deleteMany({ likedBy: userId });

      // Delete comments by the user
      const commentTodelete = await Comment.find({ owner: userId });
      for (const comment of commentTodelete) {
        const res = await Comment.findOneAndDelete(comment);
        console.log(res);
      }

      // Delete tweets by the user
      const TweetToDelte = await Tweet.find({ owner: userId });
      for (const tweet of TweetToDelte) {
        const res = await Tweet.findOneAndDelete(tweet);
      }

      // Delete subscriptions where the user is the subscriber or channel
      await Subscription.deleteMany({
        $or: [{ subscriber: userId }, { channel: userId }],
      });
      next();
    }
  } catch (error) {
    console.log(error);
  }
  next();
});

userSchema.methods.isPasswordCorrect = function (password) {
  return bcrypt.compareSync(password, this.password);
};

userSchema.methods.generateRefreshToken = function () {
  return jwt.sign(
    {
      _id: this._id,
    },
    process.env.REFRESH_TOKEN_SECRET,
    {
      expiresIn: process.env.REFRESH_TOKEN_EXPIRY,
    }
  );
};
userSchema.methods.generateAccessToken = function () {
  return jwt.sign(
    {
      _id: this._id,
      email: this.email,
      username: this.username,
      fullName: this.fullName,
    },
    process.env.ACCESS_TOKEN_SECRET,
    {
      expiresIn: process.env.ACCESS_TOKEN_EXPIRY,
    }
  );
};
export const User = mongoose.model("User", userSchema);
