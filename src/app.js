import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import swaggerUi from "swagger-ui-express";
import YAML from "yaml";
import helmet from "helmet";

export const app = express();

const signedCookiesSecret =
  process.env.COOKIEPARSER_SECRET || "I am Manish Pali";

app.use(
  cors({
    origin: [process.env.CORS_ORIGIN, process.env.CORS_ORIGIN_2, process.env.CORS_ORIGIN_3],
    credentials: true,
  })
);

app.use(
  helmet({
    contentSecurityPolicy: false,
  })
);

app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(express.static("public"));
app.use(cookieParser(signedCookiesSecret));
// app.use((req, res, next) => {
//   // res.setHeader(
//   //   "Strict-Transport-Security",
//   //   "max-age=31536000; includeSubDomains; preload" // for https
//   // );
//   // res.setHeader("Content-Type", "application/json");
//   res.setHeader("X-Content-Type-Options", "nosniff");
//   next();
// });

//middleware route
import { errorHandler } from "./middlewares/error.middlewares.js";
import { avoidInProduction } from "./middlewares/auth.middleware.js";

// seeding
import {
  getGeneratedCredentials,
  seedUsers,
  seedYoutube,
} from "./seeding/db.seeding.js";
app.get("/api/v1/seeding", avoidInProduction, seedUsers, seedYoutube);
app.get("/api/v1/credentials", avoidInProduction, getGeneratedCredentials);

//routes import
import healthcheckRouter from "./routes/healthcheck.routes.js";
import userRouter from "./routes/user.routes.js";
import tweetRouter from "./routes/tweet.routes.js";
import subscriptionRouter from "./routes/subscription.routes.js";
import videoRouter from "./routes/video.routes.js";
import commentRouter from "./routes/comment.routes.js";
import likeRouter from "./routes/like.routes.js";
import playlistRouter from "./routes/playlist.routes.js";
import dashboardRouter from "./routes/dashboard.routes.js";

//routes declaration
app.use("/api/v1/healthcheck", healthcheckRouter);
app.use("/api/v1/users", userRouter);
app.use("/api/v1/tweets", tweetRouter);
app.use("/api/v1/subscriptions", subscriptionRouter);
app.use("/api/v1/videos", videoRouter);
app.use("/api/v1/comments", commentRouter);
app.use("/api/v1/likes", likeRouter);
app.use("/api/v1/playlist", playlistRouter);
app.use("/api/v1/dashboard", dashboardRouter);

// fetching YML file for Swagger-ui
let swaggerDocument;
try {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const file = fs.readFileSync(
    path.resolve(__dirname, "./swagger.yml"),
    "utf8"
  );
  swaggerDocument = YAML.parse(file);
} catch (error) {
  console.log(error);
}
// api-documention on root path
app.use(
  "/",
  swaggerUi.serve,
  swaggerUi.setup(swaggerDocument, {
    customCss: ".swagger-ui .topbar { display: none }",
    customfavIcon:
      "https://res.cloudinary.com/doh56heah/image/upload/v1706810486/Portfollio/icons8-youtube-50_mq2ezd.png",
    customSiteTitle: "Youtube-backend",
  })
);

//404 error
app.use((req, res) => {
  res.status(404).send("Route not found");
});

//error handling middleware
app.use(errorHandler);

//todo use express-validator
