const express = require('express');
const { ApolloServer, gql } = require('apollo-server-express');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');

// ─── 1. CLIENTS GRPC ────────────────────────────────────────────────────────
function loadClient(protoFile, packageName, serviceName, port) {
  const def = protoLoader.loadSync(path.join(__dirname, '../proto', protoFile), {
    keepCase: true, longs: String, enums: String, defaults: true, oneofs: true
  });
  const proto = grpc.loadPackageDefinition(def)[packageName];
  return new proto[serviceName](`localhost:${port}`, grpc.credentials.createInsecure());
}

const orderClient        = loadClient('order.proto',        'order',        'OrderService',        50051);
const inventoryClient    = loadClient('inventory.proto',    'inventory',    'InventoryService',    50052);
const notificationClient = loadClient('notification.proto', 'notification', 'NotificationService', 50053);

function grpcCall(client, method, request) {
  return new Promise((resolve, reject) => {
    client[method](request, (err, response) => {
      if (err) reject(err);
      else resolve(response);
    });
  });
}

// ─── 2. EXPRESS ─────────────────────────────────────────────────────────────
const app = express();

app.use((req, res, next) => {
  if (req.path === '/graphql') return next();
  express.json()(req, res, next);
});

// ─── 3. REST ENDPOINTS ──────────────────────────────────────────────────────
app.post('/orders', async (req, res) => {
  try {
    const order = await grpcCall(orderClient, 'CreateOrder', req.body);
    res.status(201).json(order);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/orders', async (req, res) => {
  try {
    const result = await grpcCall(orderClient, 'ListOrders', {});
    res.json(result.orders);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/orders/:id', async (req, res) => {
  try {
    const order = await grpcCall(orderClient, 'GetOrder', { order_id: req.params.id });
    res.json(order);
  } catch (err) { res.status(404).json({ error: 'Commande introuvable' }); }
});

app.get('/products', async (req, res) => {
  try {
    const result = await grpcCall(inventoryClient, 'ListProducts', {});
    res.json(result.products);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/products/:id', async (req, res) => {
  try {
    const product = await grpcCall(inventoryClient, 'GetProduct', { product_id: req.params.id });
    res.json(product);
  } catch (err) { res.status(404).json({ error: 'Produit introuvable' }); }
});

app.get('/notifications/:customer', async (req, res) => {
  try {
    const result = await grpcCall(notificationClient, 'ListNotifications', { customer: req.params.customer });
    res.json(result.notifications);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── 4. GRAPHQL ─────────────────────────────────────────────────────────────
const typeDefs = gql`
  type Order {
    order_id:   String
    product_id: String
    quantity:   Int
    customer:   String
    status:     String
  }
  type Product {
    product_id: String
    name:       String
    stock:      Int
    price:      Float
  }
  type Notification {
    id:       String
    customer: String
    message:  String
    type:     String
    status:   String
  }
  type Query {
    listOrders:                       [Order]
    getOrder(order_id: String!):      Order
    listProducts:                     [Product]
    getProduct(product_id: String!):  Product
    listNotifications(customer: String!): [Notification]
  }
  type Mutation {
    createOrder(product_id: String!, quantity: Int!, customer: String!): Order
    sendNotification(customer: String!, message: String!, type: String!): Notification
  }
`;

const resolvers = {
  Query: {
    listOrders:        () => grpcCall(orderClient, 'ListOrders', {}).then(r => r.orders),
    getOrder:          (_, args) => grpcCall(orderClient, 'GetOrder', args),
    listProducts:      () => grpcCall(inventoryClient, 'ListProducts', {}).then(r => r.products),
    getProduct:        (_, args) => grpcCall(inventoryClient, 'GetProduct', args),
    listNotifications: (_, args) => grpcCall(notificationClient, 'ListNotifications', args).then(r => r.notifications),
  },
  Mutation: {
    createOrder:      (_, args) => grpcCall(orderClient, 'CreateOrder', args),
    sendNotification: (_, args) => grpcCall(notificationClient, 'SendNotification', args),
  }
};

// ─── 5. DÉMARRER ────────────────────────────────────────────────────────────
async function main() {
  const apollo = new ApolloServer({ typeDefs, resolvers });
  await apollo.start();
  apollo.applyMiddleware({ app });

  app.listen(3000, () => {
    console.log('🚀 API Gateway démarrée sur http://localhost:3000');
    console.log('📡 REST    → http://localhost:3000/products');
    console.log('📡 REST    → http://localhost:3000/orders');
    console.log('🔮 GraphQL → http://localhost:3000/graphql');
  });
}

main().catch(console.error);