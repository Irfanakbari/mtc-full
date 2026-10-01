import "reflect-metadata";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { OpnameQueryDto } from "../inventory-counting/dto";
import { ItemQueryDto } from "../inventory-items/dto";
import { LedgerQueryDto } from "../stock-transactions/dto";

describe("paginated query DTOs", () => {
  it.each([ItemQueryDto, LedgerQueryDto, OpnameQueryDto])(
    "converts page and limit query strings for %p",
    async (Dto) => {
      const query = plainToInstance(Dto, { page: "1", limit: "50" });

      expect(query.page).toBe(1);
      expect(query.limit).toBe(50);
      expect(await validate(query)).toHaveLength(0);
    },
  );

  it("parses item boolean filters without treating false as true", async () => {
    const query = plainToInstance(ItemQueryDto, {
      page: "1",
      limit: "50",
      active: "false",
      lowStock: "true",
    });

    expect(query.active).toBe(false);
    expect(query.lowStock).toBe(true);
    expect(await validate(query)).toHaveLength(0);
  });

  it.each([ItemQueryDto, LedgerQueryDto, OpnameQueryDto])(
    "still rejects pagination outside the supported range for %p",
    async (Dto) => {
      const query = plainToInstance(Dto, { page: "0", limit: "201" });

      expect(await validate(query)).not.toHaveLength(0);
    },
  );
});
