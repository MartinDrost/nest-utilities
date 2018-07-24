import { ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";
import XLSX from "xlsx/types";

@Injectable()
export class CsvInterceptor implements NestInterceptor {
  /**
   * Return fetched data in csv format
   * @param context
   * @param stream$
   */
  intercept(
    context: ExecutionContext,
    stream$: Observable<any>
  ): Observable<any> {
    const queryParams = context.getArgByIndex(0).query;
    const csv = queryParams.csv;

    if (csv !== undefined && csv !== "false") {
      return stream$.pipe(
        map(value => {
          // abort if the response is not an array
          if (!Array.isArray(value)) {
            return value;
          }

          // trigger toJSON method and filter subarrays
          value = JSON.parse(JSON.stringify(value));
          value = value.map((item: any) => {
            for (const key in item) {
              if (Array.isArray(item[key]) || item[key] === null) {
                delete item[key];
              }
            }
            return item;
          });

          const response = context.switchToHttp().getResponse();
          response.contentType("application/csv");

          const sheet = XLSX.utils.json_to_sheet(value);
          return XLSX.utils.sheet_to_csv(sheet);
        })
      );
    }
    return stream$;
  }
}
