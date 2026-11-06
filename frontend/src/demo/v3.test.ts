// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from "vitest";

const key = "eatwhat-demo-prototype-v3";
beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
});

it("returns the current policy and NOT_GRANTED when no consent record exists", async () => {
  const { demoTransport } = await import("./transport");
  const policy = (await demoTransport("/auth/consent/policy", {})).data as {
    version: string;
  };
  const reply = await demoTransport("/auth/consent", {});
  expect(reply.data).toEqual({
    status: "NOT_GRANTED",
    identityReady: false,
    policyVersion: policy.version,
  });
});

it("projects legacy consent into three query fields while preserving action progress and uploads", async () => {
  const upload = {
    id: 501,
    accountId: 10,
    name: "保留的上传",
    pictureUrl: ["foods/retained.jpg"],
  };
  localStorage.setItem(
    key,
    JSON.stringify({
      schemaVersion: 2,
      user: { id: 10, displayName: "食友", verified: true },
      foods: [upload],
      restaurants: [],
      tags: [],
      notifications: [],
      history: [],
      following: [],
      privacy: { following: true, follower: true },
      policy: {
        version: "current-policy-v3",
        url: "/api/policies/current-policy-v3.html",
        revision: 3,
      },
      consent: {
        status: "GRANTED",
        identityReady: true,
        policyVersion: "accepted-policy-v2",
        registrationAccepted: true,
        backfillStatus: "ACCOUNT_COMPLETE_DOMAINS_PENDING",
        cleanupStatus: "NOT_REQUIRED",
      },
    }),
  );
  const { demoTransport } = await import("./transport");
  expect((await demoTransport("/auth/consent", {})).data).toEqual({
    status: "GRANTED",
    identityReady: true,
    policyVersion: "accepted-policy-v2",
  });
  const withdrawn = await demoTransport(
    "/auth/consent/withdraw-with-password",
    {
      method: "POST",
      body: { userName: "student", password: "password1" },
    },
  );
  expect(withdrawn.data).toEqual({
    status: "WITHDRAWN",
    identityReady: true,
    policyVersion: "current-policy-v3",
    registrationAccepted: true,
    backfillStatus: "NOT_STARTED",
    cleanupStatus: "COMPLETED",
  });
  expect((await demoTransport("/auth/consent", {})).data).toEqual({
    status: "WITHDRAWN",
    identityReady: true,
    policyVersion: "current-policy-v3",
  });
  const granted = await demoTransport("/auth/consent/grant", {
    method: "POST",
    body: { policyVersion: "current-policy-v3" },
  });
  expect(granted.data).toEqual({
    status: "GRANTED",
    identityReady: true,
    policyVersion: "current-policy-v3",
    registrationAccepted: true,
    backfillStatus: "ACCOUNT_COMPLETE_DOMAINS_PENDING",
    cleanupStatus: "NOT_REQUIRED",
  });
  const withdrawnAgain = await demoTransport("/auth/consent/withdraw", {
    method: "POST",
  });
  expect(withdrawnAgain.data).toEqual({
    status: "WITHDRAWN",
    identityReady: false,
    policyVersion: "current-policy-v3",
    registrationAccepted: true,
    backfillStatus: "NOT_STARTED",
    cleanupStatus: "COMPLETED",
  });
  expect((await demoTransport("/auth/consent", {})).data).toEqual({
    status: "WITHDRAWN",
    identityReady: false,
    policyVersion: "current-policy-v3",
  });
  const saved = JSON.parse(localStorage.getItem(key)!).foods;
  expect(saved).toHaveLength(1);
  expect(saved[0]).toMatchObject(upload);
});
