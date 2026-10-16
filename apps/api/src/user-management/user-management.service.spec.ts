import { ConflictException, NotFoundException } from "@nestjs/common";
import type { CurrentUserIdentity } from "../auth/current-user.interface";
import { PrismaService } from "../prisma/prisma.service";
import { UserManagementService } from "./user-management.service";

describe("UserManagementService.deleteUser", () => {
  const actor: CurrentUserIdentity = {
    username: "current-sso-id",
    name: "Current User",
    email: "current@example.com",
    permissions: [],
    authType: "SSO",
  };
  const prisma = {
    appUser: {
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
  };
  const service = new UserManagementService(prisma as unknown as PrismaService);

  beforeEach(() => jest.clearAllMocks());

  it("deletes an existing user that is not the current user", async () => {
    prisma.appUser.findUnique.mockResolvedValue({
      Id: "user-id",
      SsoObjectId: "other-sso-id",
    });
    prisma.appUser.delete.mockResolvedValue({ Id: "user-id" });

    await expect(service.deleteUser("user-id", actor)).resolves.toEqual({
      deleted: true,
      id: "user-id",
    });
    expect(prisma.appUser.delete).toHaveBeenCalledWith({
      where: { Id: "user-id" },
    });
  });

  it("rejects an unknown user", async () => {
    prisma.appUser.findUnique.mockResolvedValue(null);

    await expect(
      service.deleteUser("missing-id", actor),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.appUser.delete).not.toHaveBeenCalled();
  });

  it("prevents users from deleting their own account", async () => {
    prisma.appUser.findUnique.mockResolvedValue({
      Id: "current-id",
      SsoObjectId: actor.username,
    });

    await expect(
      service.deleteUser("current-id", actor),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.appUser.delete).not.toHaveBeenCalled();
  });
});
