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
  const otp = Math.floor(1000 + Math.random() * 9000); // Generate a 4-digit OTP
  const apiUrl = `https://sm.appstore.et/xsender/send?username=insa&password=insa&to=${phone}&content=Your OTP code is ${otp}`;

  try {
    const response = await axios.get(apiUrl);
    if (response.data && response.data.status === "success") {
      return otp;
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

  try {
    const [existingUser] = await db
      .promise()
      .query("SELECT * FROM users WHERE phone = ?", [phone]);

    const otp = await sendOtp(phone);
    if (!otp) {
      return res
        .status(500)
        .json({ status: "error", message: "Failed to send OTP." });
    }

    if (existingUser.length === 0) {
      await db
        .promise()
        .execute("INSERT INTO users (phone, password) VALUES (?, ?)", [
          phone,
          otp,
        ]);
      return res
        .status(200)
        .json({
          status: "success",
          message: "User registered successfully! OTP sent.",
          otp,
        });
    } else {
      await db
        .promise()
        .execute("UPDATE users SET password = ? WHERE phone = ?", [otp, phone]);
      return res
        .status(200)
        .json({
          status: "success",
          message: "OTP sent for verification!",
          otp,
        });
    }
  } catch (error) {
    console.error("Database error:", error.message);
    return res
      .status(500)
      .json({ status: "error", message: "Database error: " + error.message });
  }
});

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
        return res
          .status(400)
          .json({ status: "error", message: "Invalid phone number or OTP." });
      }

      return res
        .status(200)
        .json({ status: "success", message: "OTP verified successfully." });
    }
  );
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
