
const express = require("express");
const path = require("node:path");

const app = express();
const PORT = 3000;

app.use(express.static(path.join(__dirname, "../frontend")));

app.get("/", (req, res) => {
  res.send("Bienvenue sur Vite & Gourmand !");
});

app.listen(PORT, () => {
  console.log(`Serveur démarré sur http://localhost:${PORT}`);
});
