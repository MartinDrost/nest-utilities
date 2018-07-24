import { IHttp } from "../../interfaces/http.interface";

export abstract class ClientCrudService<IModel> {
  constructor(
    protected readonly controller: string,
    protected readonly http: IHttp
  ) {}

  /**
   * Fetches a list of all models
   */
  public getAll(): Promise<IModel[]> {
    return this.http.get<IModel[]>(this.controller);
  }

  /**
   * Fetches a specific model by id
   * @param id
   */
  public get(id: string): Promise<IModel> {
    return this.http.get<IModel>([this.controller, id].join("/"));
  }

  /**
   * Fetches a specific model by id
   * @param id
   */
  public getMany(ids: string[]): Promise<IModel[]> {
    return this.http.get<IModel[]>([this.controller, ids.join(",")].join("/"));
  }

  /**
   * Creates a new model
   * @param model
   */
  public create(model: IModel): Promise<IModel> {
    return this.http.post<IModel>(this.controller, model);
  }

  /**
   * Updates a specific model
   * @param model
   */
  public update(model: IModel): Promise<IModel> {
    return this.http.put<IModel>(this.controller, model);
  }

  /**
   * Deletes a specific model
   * @param id
   */
  public delete(id: string): Promise<IModel> {
    return this.http.delete<IModel>([this.controller, id].join("/"));
  }
}
