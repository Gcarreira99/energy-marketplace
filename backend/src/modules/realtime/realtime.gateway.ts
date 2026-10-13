import { Logger } from "@nestjs/common";
import { OnGatewayConnection, WebSocketGateway, WebSocketServer } from "@nestjs/websockets";
import type { IncomingMessage } from "node:http";
import { Server, WebSocket } from "ws";

export type RealtimeEvent =
  | "simulation.tick"
  | "market.activity";

// Browsers skip CORS for WebSockets, so check the Origin header ourselves.
const allowedOrigin = process.env.FRONTEND_ORIGIN ?? "http://localhost:3000";

@WebSocketGateway({ path: "/v1/realtime" })
export class RealtimeGateway implements OnGatewayConnection {
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  private readonly server!: Server;

  handleConnection(client: WebSocket, request: IncomingMessage) {
    const origin = request.headers.origin;
    if (origin && origin !== allowedOrigin) {
      this.logger.warn(`Rejected realtime connection from ${origin}`);
      client.close(1008, "Origin not allowed");
    }
  }

  broadcast(event: RealtimeEvent, data: unknown) {
    if (!this.server) return;
    const message = JSON.stringify({ event, data });
    for (const client of this.server.clients) {
      if (client.readyState === WebSocket.OPEN) client.send(message);
    }
  }
}
