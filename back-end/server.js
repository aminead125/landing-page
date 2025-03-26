require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
const port = process.env.PORT || 5000;

// Middleware avec une limite de payload augmentée (50mb)
app.use(cors());
app.use(express.json({ limit: "50mb" }));

// Connexion à PostgreSQL
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

pool.connect()
  .then(() => console.log("✅ Connecté à PostgreSQL"))
  .catch(err => console.error("❌ Erreur de connexion à PostgreSQL", err));

/* ======================================================
   Routes Commandes
====================================================== */

// Route POST pour créer une commande et décrémenter le stock
app.post("/api/commande", async (req, res) => {
  try {
    const { nom, prenom, telephone, willaya, province, adresse, message, quantite, montant_total, statut } = req.body;
    
    // Vérifier le stock disponible avant de créer la commande
    const stockResult = await pool.query("SELECT stock FROM produit LIMIT 1");
    const currentStock = stockResult.rows[0].stock;
    
    if (currentStock < quantite) {
      return res.status(400).json({ success: false, message: "Stock insuffisant" });
    }
    
    // Insertion de la commande
    const query = `
      INSERT INTO commandes (nom, prenom, telephone, willaya, province, adresse, message, quantite, montant_total, statut) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *
    `;
    const values = [nom, prenom, telephone, willaya, province, adresse, message, quantite, montant_total, statut];
    const result = await pool.query(query, values);
    
    // Décrémenter le stock du nombre d'articles commandés
    const newStock = currentStock - quantite;
    await pool.query("UPDATE produit SET stock = $1", [newStock]);
    
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Erreur serveur" });
  }
});

// Route GET pour récupérer les commandes
app.get("/api/commande", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT c.id AS commande_id, 
             c.nom, 
             c.prenom, 
             c.telephone,
             c.province,
             c.adresse, 
             c.quantite, 
             c.montant_total, 
             cs.libelle AS statut_libelle
      FROM commandes c
      LEFT JOIN commande_statut cs ON c.statut = cs.id
      ORDER BY c.id DESC
    `);
    
    res.status(200).json({ success: true, data: result.rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Erreur serveur" });
  }
});

// Route PUT pour mettre à jour le statut d'une commande sans modifier le stock lors de la confirmation
app.put("/api/commande/:id", async (req, res) => {
  try {
    const commandeId = req.params.id;
    const { statut } = req.body;

    // Récupérer la commande pour vérifier son existence
    const commandeQuery = "SELECT * FROM commandes WHERE id = $1";
    const commandeResult = await pool.query(commandeQuery, [commandeId]);
    if (commandeResult.rowCount === 0) {
      return res.status(404).json({ success: false, message: "Commande introuvable" });
    }
    
    // Mise à jour du statut sans toucher au stock
    const updateQuery = "UPDATE commandes SET statut = $1 WHERE id = $2 RETURNING *";
    const updateResult = await pool.query(updateQuery, [statut, commandeId]);

    return res.status(200).json({ success: true, data: updateResult.rows[0] });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Erreur serveur" });
  }
});

// Route DELETE pour supprimer une commande et réajuster le stock
app.delete("/api/commande/:id", async (req, res) => {
  try {
    const commandeId = req.params.id;

    // Récupérer la commande pour connaître la quantité commandée
    const checkQuery = `SELECT * FROM commandes WHERE id = $1`;
    const checkResult = await pool.query(checkQuery, [commandeId]);

    if (checkResult.rowCount === 0) {
      return res.status(404).json({ success: false, message: "Commande introuvable" });
    }
    
    const commande = checkResult.rows[0];
    const quantiteCommande = commande.quantite;

    // Supprimer la commande
    const deleteQuery = `DELETE FROM commandes WHERE id = $1 RETURNING *`;
    const deleteResult = await pool.query(deleteQuery, [commandeId]);

    // Récupérer le stock actuel du produit
    const stockResult = await pool.query("SELECT stock FROM produit LIMIT 1");
    const currentStock = stockResult.rows[0].stock;
    
    // Incrémenter le stock avec la quantité de la commande supprimée
    const newStock = currentStock + quantiteCommande;
    await pool.query("UPDATE produit SET stock = $1", [newStock]);

    return res.status(200).json({ success: true, message: "Commande supprimée et stock réajusté", data: deleteResult.rows[0] });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Erreur serveur" });
  }
});

/* ======================================================
   Gestion des produits et de leurs caractéristiques
====================================================== */

// Route POST pour ajouter un produit (limité à 1 produit)
app.post("/api/produit", async (req, res) => {
  try {
    const { name, slug, price, promotional_price, stock, delivery_time, description, features, images } = req.body;
    
    const productQuery = `
      INSERT INTO produit (name, slug, price, promotional_price, stock, delivery_time, description)
      VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *
    `;
    const productValues = [name, slug, price, promotional_price, stock, delivery_time, description];
    const productResult = await pool.query(productQuery, productValues);
    const newProduct = productResult.rows[0];

    // Ajout des caractéristiques du produit dans la table séparée
    if (features && Array.isArray(features)) {
      const featureQuery = `INSERT INTO product_features (produit_id, feature) VALUES ($1, $2)`;
      const featurePromises = features.map(feature => pool.query(featureQuery, [newProduct.id, feature]));
      await Promise.all(featurePromises);
    }

    // Ajout des images du produit
    let insertedImages = [];
    if (images && Array.isArray(images) && images.length > 0) {
      const imageQuery = `INSERT INTO "product-image" (produit_id, image_url, angle) VALUES ($1, $2, $3) RETURNING *`;
      const imagePromises = images.map(image => pool.query(imageQuery, [newProduct.id, image.image_url, image.angle]));
      insertedImages = (await Promise.all(imagePromises)).map(result => result.rows[0]);
    }

    res.status(201).json({ success: true, data: newProduct, images: insertedImages });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Erreur serveur" });
  }
});

// Route GET pour récupérer le premier produit avec ses caractéristiques et images
app.get("/api/produit", async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM produit ORDER BY id ASC LIMIT 1`);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Aucun produit trouvé" });
    }
    const produit = result.rows[0];

    // Récupérer les caractéristiques du produit
    const featuresResult = await pool.query(`SELECT feature FROM product_features WHERE produit_id = $1`, [produit.id]);
    const features = featuresResult.rows.map(row => row.feature);

    const imagesResult = await pool.query(`SELECT * FROM "product-image" WHERE produit_id = $1`, [produit.id]);

    res.status(200).json({
      success: true,
      data: {
        produit,
        features,
        images: imagesResult.rows
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Erreur serveur" });
  }
});

// Route PUT pour modifier les informations du produit
app.put("/api/produit/:id", async (req, res) => {
  try {
    const produitId = req.params.id;
    const { name, slug, price, promotional_price, stock, delivery_time, description } = req.body;
    const query = `
      UPDATE produit 
      SET name = $1, slug = $2, price = $3, promotional_price = $4, stock = $5, delivery_time = $6, description = $7
      WHERE id = $8 RETURNING *
    `;
    const values = [name, slug, price, promotional_price, stock, delivery_time, description, produitId];
    const result = await pool.query(query, values);
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: "Produit introuvable" });
    }
    res.status(200).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Erreur serveur" });
  }
});

app.listen(port, () => {
  console.log(`🚀 Serveur lancé sur http://localhost:${port}`);
});
