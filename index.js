import * as dotenv from "dotenv";
import express, { response } from "express";
import querystring from "querystring";
import axios from "axios";
import path from "path";

dotenv.config();
const app = express();
const port = 8080;
const clientId = process.env.client_id;
const clientSecret = process.env.client_secret;
const redirectUri = process.env.redirect_uri;

app.set("view engine", "ejs");
app.use(express.static("views"));

function generateRandomString(length) {
  var text = "";
  var possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (var i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
const stateKey = "spotify_auth_state";

app.get("/", (req, res) => {
  var state = generateRandomString(16);
  res.cookie(stateKey, state);
  var scope = "user-read-private user-read-email user-top-read";
  res.redirect(
    "https://accounts.spotify.com/authorize?" +
      querystring.stringify({
        response_type: "code",
        client_id: clientId,
        scope: scope,
        redirect_uri: redirectUri,
        state: state,
      })
  );
});

app.get("/callback", (req, res) => {
  const code = req.query.code || null;
  axios({
    method: "post",
    url: "https://accounts.spotify.com/api/token",
    data: querystring.stringify({
      grant_type: "authorization_code",
      code: code,
      redirect_uri: redirectUri,
    }),
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${new Buffer.from(
        `${clientId}:${clientSecret}`
      ).toString("base64")}`,
    },
  })
    .then((response) => {
      if (response.status === 200) {
        // const { access_token, token_type } = response.data;
        const { refresh_token } = response.data;

        axios
          .get(
            `http://localhost:8080/refresh_token?refresh_token=${refresh_token}`
          )
          .then((response) => {
            if (response.status === 200) {
              const { access_token, token_type } = response.data;
              axios
                .get(
                  "https://api.spotify.com/v1/me/top/tracks?time_range=short_term&limit=5",
                  {
                    headers: {
                      Authorization: `${token_type} ${access_token}`,
                    },
                  }
                )
                .then((response) => {
                  var songData = response.data;
                  res.render("index", { songData });
                  songData.items.forEach((item) => {
                    var songname = item.name;
                    var artist = item.artists[0].name;
                    console.log(songname + " by " + artist);
                  });
                  // res.send(`${JSON.stringify(songData, null, 2)}`);
                })
                .catch((error) => {
                  res.send(error);
                });
            } else {
              res.send(JSON.stringify(response));
            }
          })
          .catch((error) => {
            res.send(error);
          });
      } else {
        res.send(JSON.stringify(response));
      }
    })
    .catch((error) => {
      res.send("error");
    });
});

app.get("/refresh_token", (req, res) => {
  const { refresh_token } = req.query;

  axios({
    method: "post",
    url: "https://accounts.spotify.com/api/token",
    data: querystring.stringify({
      grant_type: "refresh_token",
      refresh_token: refresh_token,
    }),
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${new Buffer.from(
        `${clientId}:${clientSecret}`
      ).toString("base64")}`,
    },
  })
    .then((response) => {
      res.send(response.data);
    })
    .catch((error) => {
      res.send(error);
    });
});

app.listen(port, () => {
  console.log(`listening on port ${port}`);
});
