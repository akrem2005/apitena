const express = require("express");
const mysql = require("mysql2");
const axios = require("axios");
const bodyParser = require("body-parser");

const app = express();
const port = 3000;

app.use(bodyParser.json());

const db = mysql.createConnection({
  host: "afrisoftware.et",
  port: 3306,
  user: "afrisoft_dev",
  password: "@Frisoftware",
  database: "afrisoft_tenapp",
});

db.connect((err) => {
  if (err) {
    console.error("Error connecting to the database: " + err.stack);
    return;
  }
  console.log("Connected to the database.");
});

const sendOtp = async (phone) => {
  const apiUrl = "https://api.afromessage.com/api/challenge";
  const queryParams = {
    from: "e80ad9d8-adf3-463f-80f4-7c4b39f7f164",
    sender: 9786,
    to: phone,
    len: 4,
    t: 0,
    ttl: 300,
  };

  const fullUrl = `${apiUrl}?${new URLSearchParams(queryParams).toString()}`;

  try {
    const response = await axios.get(fullUrl, {
      headers: {
        Authorization: `Bearer eyJhbGciOiJIUzI1NiJ9.eyJpZGVudGlmaWVyIjoiVDMyZElMTGlxWTBJNzNXbzQzY0gyd2VyYUpZZXVXYVkiLCJleHAiOjE4NzQ0NzU1ODksImlhdCI6MTcxNjcwOTE4OSwianRpIjoiZjA1OWVlMmUtYzM1ZC00ZTRmLWIyODAtYmI5NGFhYThhODRhIn0.nhS0gcrx0AORitGqm2LtJLDTCvxNuTePqCNArXcbpEQ`,
        "Content-Type": "application/json",
      },
    });

    if (
      response.data &&
      response.data.response &&
      response.data.response.code
    ) {
      return response.data.response.code;
    }
    return null;
  } catch (error) {
    console.error("Error sending OTP: ", error.message);
    return null;
  }
};

app.post("/register-and-verify", async (req, res) => {
  const { phone } = req.body;
  if (!phone) {
    return res
      .status(400)
      .json({ status: "error", message: "Phone number is required." });
  }

  db.execute(
    "SELECT * FROM users WHERE phone = ?",
    [phone],
    async (err, results) => {
      if (err) {
        return res
          .status(500)
          .json({ status: "error", message: "Database error: " + err.message });
      }

      const otp = await sendOtp(phone);
      if (!otp) {
        return res
          .status(500)
          .json({ status: "error", message: "Failed to send OTP." });
      }

      if (results.length === 0) {
        db.execute(
          "INSERT INTO users (phone, password) VALUES (?, ?)",
          [phone, otp],
          (err) => {
            if (err) {
              return res.status(500).json({
                status: "error",
                message: "Error registering user: " + err.message,
              });
            }
            return res.status(200).json({
              status: "success",
              message: "User registered successfully! OTP sent.",
              otp,
            });
          }
        );
      } else {
        db.execute(
          "UPDATE users SET password = ? WHERE phone = ?",
          [otp, phone],
          (err) => {
            if (err) {
              return res.status(500).json({
                status: "error",
                message: "Error updating OTP: " + err.message,
              });
            }
            return res.status(200).json({
              status: "success",
              message: "OTP sent for verification!",
              otp,
            });
          }
        );
      }
    }
  );
});

// Verify OTP route
app.post("/verify", (req, res) => {
  const { phone, otp } = req.body;
  if (!phone || !otp) {
    return res
      .status(400)
      .json({ status: "error", message: "Phone number and OTP are required." });
  }

  db.execute(
    "SELECT * FROM users WHERE phone = ? AND password = ?",
    [phone, otp],
    (err, results) => {
      if (err) {
        return res
          .status(500)
          .json({ status: "error", message: "Database error: " + err.message });
      }

      if (results.length === 0) {
        return res.status(400).json({
          status: "error",
          message: "Invalid phone number or OTP.",
        });
      }

      return res.status(200).json({
        status: "success",
        message: "OTP verified successfully.",
      });
    }
  );
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
