import {
  ExecutionContext,
  Injectable,
  NestInterceptor,
  CallHandler
} from "@nestjs/common";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";
import _pick from "lodash/pick";

@Injectable()
export class PickInterceptor implements NestInterceptor {
  /**
   * Pick a certain selection of attributes from a response omitting the rest.
   * f.e.: ..user?pick=firstName,lastName,children.firstName
   * @param context
   * @param next
   */
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const queryParams = context.getArgByIndex(0).query;
    const pick = queryParams.pick;

    // manipulate the return data if the pick parameter is given
    if (pick) {
      return next.handle().pipe(
        map(value => {
          const attributes = (pick || "").split(",");
          return this.deepPick(value, attributes);
        })
      );
    }
    return next.handle();
  }

  /**
   * An extension on the lodash pick method which supports nested picking
   * @param value
   * @param attributes
   */
  private deepPick(value: object | any[], attributes = []): object | any[] {
    // check if the attributes contain nested targets
    const attributeSet = new Set();
    const nestedAttributes: { [attribute: string]: string[] } = {};
    for (const attribute of attributes) {
      if (attribute.includes(".")) {
        const nested = attribute.split(".");
        const key = nested.shift();

        nestedAttributes[key] = nestedAttributes[key] || [];
        nestedAttributes[key].push(nested.join("."));
        attributeSet.add(key);
      } else {
        attributeSet.add(attribute);
      }
    }

    // pick the nested attributes
    for (const key of Object.keys(nestedAttributes)) {
      value[key] = this.deepPick(value[key], nestedAttributes[key]);
    }

    // return the set to an array and do the actual picking
    attributes = Array.from(attributeSet);
    if (Array.isArray(value)) {
      return value.map(item => _pick(item, attributes));
    }
    return _pick(value, attributes);
  }
}
