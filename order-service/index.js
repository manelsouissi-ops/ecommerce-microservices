const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const Database = require('better-sqlite3');
const { Kafka } = require('kafkajs');
const path = require('path');
const crypto = require('crypto');

// ─── 1. CHARGER LE FICHIER .PROTO ───────────────────────────────────────────
// protoLoader lit le fichier order.proto et le traduit en objet JS
const packageDef = protoLoader.loadSync(
  path.join(__dirname, '../proto/order.proto'),
  { keepCase: true, longs: String, enums: String, defaults: true, oneofs: true }
);
const orderProto = grpc.loadPackageDefinition(packageDef).order;

// ─── 2. BASE DE DONNÉES SQLITE3 ─────────────────────────────────────────────
// Crée (ou ouvre) le fichier orders.db dans le dossier order-service
const db = new Database(path.join(__dirname, 'orders.db'));

// Crée la table si elle n'existe pas encore
db.exec(`
  CREATE TABLE IF NOT EXISTS orders (
    order_id   TEXT PRIMARY KEY,
    product_id TEXT NOT NULL,
    quantity   INTEGER NOT NULL,
    customer   TEXT NOT NULL,
    status     TEXT DEFAULT 'pending'
  )
`);

console.log('✅ Base de données SQLite3 prête');

// ─── 3. CLIENT KAFKA (PRODUCTEUR) ───────────────────────────────────────────
const kafka = new Kafka({
  clientId: 'order-service',
  brokers: ['localhost:9092']   // adresse du broker Kafka dans Docker
});
const producer = kafka.producer();

async function connectKafka() {
  await producer.connect();
  console.log('✅ Kafka producteur connecté');
}

// ─── 4. IMPLÉMENTATION DES FONCTIONS GRPC ───────────────────────────────────
// Ces fonctions correspondent exactement aux "rpc" définis dans order.proto

async function CreateOrder(call, callback) {
  const { product_id, quantity, customer } = call.request;

  // Générer un ID unique pour la commande
  const order_id = crypto.randomUUID();

  // Sauvegarder en base
  db.prepare(`
    INSERT INTO orders (order_id, product_id, quantity, customer, status)
    VALUES (?, ?, ?, ?, 'pending')
  `).run(order_id, product_id, quantity, customer);

  // Publier l'événement Kafka
  await producer.send({
    topic: 'order.placed',
    messages: [{
      value: JSON.stringify({ order_id, product_id, quantity, customer })
    }]
  });

  console.log(`📦 Commande créée : ${order_id}`);

  // Retourner la commande créée au client gRPC
  callback(null, { order_id, product_id, quantity, customer, status: 'pending' });
}

function GetOrder(call, callback) {
  const { order_id } = call.request;
  const order = db.prepare('SELECT * FROM orders WHERE order_id = ?').get(order_id);

  if (!order) {
    // Retourner une erreur gRPC si la commande n'existe pas
    return callback({ code: grpc.status.NOT_FOUND, message: 'Commande introuvable' });
  }

  callback(null, order);
}

function ListOrders(call, callback) {
  const orders = db.prepare('SELECT * FROM orders').all();
  callback(null, { orders });
}

// ─── 5. DÉMARRER LE SERVEUR GRPC ────────────────────────────────────────────
async function main() {
  await connectKafka();

  const server = new grpc.Server();

  // Enregistrer les fonctions du service
  server.addService(orderProto.OrderService.service, {
    CreateOrder,
    GetOrder,
    ListOrders
  });

  // Écouter sur le port 50051
  server.bindAsync(
    '0.0.0.0:50051',
    grpc.ServerCredentials.createInsecure(),
    (err, port) => {
      if (err) {
        console.error('Erreur démarrage gRPC :', err);
        return;
      }
      console.log(`🚀 OrderService gRPC démarré sur le port ${port}`);
    }
  );
}

main().catch(console.error);