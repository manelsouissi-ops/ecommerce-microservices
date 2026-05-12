process.env.KAFKAJS_NO_PARTITIONER_WARNING = '1';

const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const Database = require('better-sqlite3');
const { Kafka } = require('kafkajs');
const path = require('path');

// ─── 1. CHARGER LE FICHIER .PROTO ───────────────────────────────────────────
const packageDef = protoLoader.loadSync(
  path.join(__dirname, '../proto/inventory.proto'),
  { keepCase: true, longs: String, enums: String, defaults: true, oneofs: true }
);
const inventoryProto = grpc.loadPackageDefinition(packageDef).inventory;

// ─── 2. BASE DE DONNÉES SQLITE3 ─────────────────────────────────────────────
const db = new Database(path.join(__dirname, 'inventory.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    product_id TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    stock      INTEGER NOT NULL,
    price      REAL NOT NULL
  )
`);

// Insérer quelques produits de démo si la table est vide
const count = db.prepare('SELECT COUNT(*) as n FROM products').get();
if (count.n === 0) {
  db.prepare(`INSERT INTO products VALUES (?, ?, ?, ?)`).run('p1', 'Laptop',  10, 999.99);
  db.prepare(`INSERT INTO products VALUES (?, ?, ?, ?)`).run('p2', 'Phone',   25, 499.99);
  db.prepare(`INSERT INTO products VALUES (?, ?, ?, ?)`).run('p3', 'Headset', 50, 79.99);
  console.log('✅ Produits de démo insérés');
}

console.log('✅ Base de données SQLite3 prête');

// ─── 3. CONSOMMATEUR KAFKA ───────────────────────────────────────────────────
// InventoryService ÉCOUTE l'événement order.placed publié par OrderService
const kafka = new Kafka({ clientId: 'inventory-service', brokers: ['localhost:9092'] });
const consumer = kafka.consumer({ groupId: 'inventory-group' });

async function connectKafkaConsumer() {
  await consumer.connect();
  await consumer.subscribe({ topic: 'order.placed', fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ message }) => {
      const order = JSON.parse(message.value.toString());
      console.log(`📨 Événement reçu : order.placed pour produit ${order.product_id}`);

      // Déduire le stock du produit commandé
      const result = db.prepare(`
        UPDATE products SET stock = stock - ? WHERE product_id = ? AND stock >= ?
      `).run(order.quantity, order.product_id, order.quantity);

      if (result.changes > 0) {
        console.log(`📦 Stock mis à jour : -${order.quantity} pour ${order.product_id}`);
      } else {
        console.log(`⚠️ Stock insuffisant pour ${order.product_id}`);
      }
    }
  });

  console.log('✅ Kafka consommateur connecté — écoute order.placed');
}

// ─── 4. IMPLÉMENTATION DES FONCTIONS GRPC ───────────────────────────────────
function GetProduct(call, callback) {
  const product = db.prepare('SELECT * FROM products WHERE product_id = ?')
                    .get(call.request.product_id);
  if (!product) {
    return callback({ code: grpc.status.NOT_FOUND, message: 'Produit introuvable' });
  }
  callback(null, product);
}

function ListProducts(call, callback) {
  const products = db.prepare('SELECT * FROM products').all();
  callback(null, { products });
}

function UpdateStock(call, callback) {
  const { product_id, quantity } = call.request;
  db.prepare('UPDATE products SET stock = ? WHERE product_id = ?')
    .run(quantity, product_id);
  const product = db.prepare('SELECT * FROM products WHERE product_id = ?')
                    .get(product_id);
  callback(null, product);
}

// ─── 5. DÉMARRER LE SERVEUR GRPC ────────────────────────────────────────────
async function main() {
  await connectKafkaConsumer();

  const server = new grpc.Server();
  server.addService(inventoryProto.InventoryService.service, {
    GetProduct,
    ListProducts,
    UpdateStock
  });

  server.bindAsync(
    '0.0.0.0:50052',
    grpc.ServerCredentials.createInsecure(),
    (err, port) => {
      if (err) { console.error('Erreur démarrage gRPC :', err); return; }
      console.log(`🚀 InventoryService gRPC démarré sur le port ${port}`);
    }
  );
}

main().catch(console.error);