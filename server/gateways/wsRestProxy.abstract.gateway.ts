import { IWebSocket } from "../../interfaces/webSocket.interface";
import { HttpService } from "@nestjs/common";
import { OnGatewayConnection } from "@nestjs/websockets";
import { AxiosRequestConfig, AxiosResponse } from "axios";
import { IWebSocketCrudParams } from "../../interfaces/webSocketCrudParams.interface";
import { Observable } from "rxjs";

export abstract class WsRestProxy implements OnGatewayConnection {
  constructor(
    protected readonly serverHost: string,
    private readonly http: HttpService
  ) {}

  /**
   * Bind crud events to connected sockets
   * @param client
   */
  handleConnection(client: any) {
    client.on("message", data => {
      const payload = JSON.parse(data);
      if (payload.event.search(/(POST|GET|PUT|DELETE) /) === 0) {
        this.proxy(client, payload.event, payload.data);
      }
    });
  }

  /**
   * Allow a socket client to maken calls to the servers' Restful API
   *
   * @param client
   * @param event
   * @param payload
   */
  async proxy(
    client: IWebSocket,
    event: string,
    payload: IWebSocketCrudParams
  ): Promise<void> {
    try {
      const eventParts = event.split(" ");
      const config = this.getAxiosConfig(client);
      const parsedEvent = this.parseUrl(`${eventParts[1]}`, payload);
      const url = `${this.serverHost}/${parsedEvent}`;

      // figure out which request has to be executed
      let request: Observable<AxiosResponse> = null;
      if (eventParts[0] === "POST") {
        request = this.http.post(url, payload.body, config);
      } else if (eventParts[0] === "GET") {
        request = this.http.get(url, config);
      } else if (eventParts[0] === "PUT") {
        request = this.http.put(url, payload.body, config);
      } else if (eventParts[0] === "DELETE") {
        request = this.http.delete(url, config);
      }

      // await and send the response
      const response = await request.toPromise();
      client["send"](
        JSON.stringify({
          event: parsedEvent.split("?")[0],
          data: response.data
        })
      );
    } catch (err) {
      // send the error code
      client["send"](
        JSON.stringify({
          event: 0,
          data: err.response.data
        })
      );
    }
  }

  /**
   * Returns the axios config required to make requests
   * @param client
   */
  private getAxiosConfig(client: IWebSocket): AxiosRequestConfig {
    return {
      headers: {
        Authorization: client.token || ""
      }
    };
  }

  /**
   * Parses an url to match the path and queryparams
   * @param url
   * @param payload
   */
  private parseUrl(url: string, payload: IWebSocketCrudParams): string {
    if (!payload) {
      return url;
    }

    // replace pathParams
    for (const pathParam of payload.path || []) {
      url = url.replace(/\/:\w+\/?/, "/" + pathParam);
    }

    // add queryParams
    const queryKeys = Object.keys(payload.query || {});
    for (let i = 0; i < queryKeys.length; i++) {
      const prefix = i === 0 ? "?" : "&";
      url += `${prefix}${queryKeys[i]}=${payload.query[queryKeys[i]]}`;
    }

    return url;
  }
}
