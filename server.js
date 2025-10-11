const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const { Server } = require("socket.io");

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = 3000;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error("Error occurred handling", req.url, err);
      res.statusCode = 500;
      res.end("internal server error");
    }
  });

  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);

    // Test event listener
    socket.on("test_event", (data) => {
      console.log("Test event received:", data);
      // Broadcast to all clients
      io.emit("test_event", data);
    });

    // Listen for objective status updates from mock page
    socket.on("update_objective", (data) => {
      console.log("📥 Received update_objective from client:", socket.id);
      console.log("   Data:", JSON.stringify(data, null, 2));
      // Broadcast to all clients with id, status, and message
      io.emit("objective_updated", data);
      console.log("📤 Broadcasted objective_updated to all clients");
    });

    // Listen for insight triggers from mock page
    socket.on("trigger_insight", (data) => {
      console.log("Insight triggered:", data);
      console.log("Broadcasting new_insight to all clients");
      // Broadcast to all clients
      io.emit("new_insight", data);
    });

    // Listen for action item triggers from mock page
    socket.on("trigger_action_item", (data) => {
      console.log("Action item triggered:", data);
      console.log("Broadcasting new_action_item to all clients");
      // Broadcast to all clients
      io.emit("new_action_item", data);
    });

    // Listen for action item completion from call page
    socket.on("complete_action_item", (data) => {
      console.log("Action item completed:", data);
      // Broadcast to all clients
      io.emit("action_item_complete", data);
    });

    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);
    });
  });

  httpServer
    .once("error", (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`);
      console.log(`> Socket.IO server running`);
    });
});
