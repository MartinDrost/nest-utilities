import { ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { Observable, of } from "rxjs";
import { map } from "rxjs/operators";
import { ICacheSettings } from "../../interfaces/cacheSettings.interface";

@Injectable()
export class CacheInterceptor implements NestInterceptor {
  public static queueLength = 20;
  public settings: ICacheSettings;
  private static cache: {
    url: string;
    value: any;
    lifetime: number;
    createdAt: number;
  }[] = [];

  constructor(settings?: ICacheSettings) {
    this.settings = {
      lifetime: 600000,

      ...settings
    };
  }

  intercept(
    context: ExecutionContext,
    stream$: Observable<any>
  ): Observable<any> {
    const url = context.getArgByIndex(0).url;

    // return cached value if present
    const cached = this.getCachedValue(url);
    if (cached) {
      return of(cached);
    }

    // save the response in the cache object otherwise
    return stream$.pipe(
      map(value => {
        this.setCachedValue(url, value);
        return value;
      })
    );
  }

  /**
   * Returns a valid cached value
   * @param url
   */
  private getCachedValue(url: string): any {
    this.limitQueue();

    const cached = CacheInterceptor.cache.find(i => i.url === url);
    if (cached) {
      return cached.value;
    }
    return null;
  }

  /**
   * Sets a new value in the cache
   * @param url
   * @param value
   */
  private setCachedValue(url: string, value: any): void {
    CacheInterceptor.cache.unshift({
      url,
      value,
      lifetime: this.settings.lifetime,
      createdAt: Date.now()
    });
  }

  /**
   * Limit the array of cached items to the max length
   */
  private limitQueue(): void {
    CacheInterceptor.cache = CacheInterceptor.cache.filter(
      i => Date.now() - i.createdAt < i.lifetime
    );
    CacheInterceptor.cache.splice(
      CacheInterceptor.queueLength,
      CacheInterceptor.cache.length
    );
  }
}
