import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertEventSchema } from "@shared/schema";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Event Management Routes
  app.get("/api/events", async (_req, res) => {
    const events = await storage.getEvents();
    res.json(events);
  });

  app.post("/api/events", async (req, res) => {
    const parseResult = insertEventSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: parseResult.error });
    }
    const event = await storage.createEvent(parseResult.data);
    res.status(201).json(event);
  });

  app.patch("/api/events/:id", async (req, res) => {
    const id = req.params.id;
    const event = await storage.updateEvent(id, req.body);
    if (!event) return res.status(404).json({ message: "Event not found" });
    res.json(event);
  });

  app.delete("/api/events/:id", async (req, res) => {
    const id = req.params.id;
    await storage.deleteEvent(id);
    res.sendStatus(204);
  });

  return httpServer;
}
