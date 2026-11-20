import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import {
  loginExistingAccount,
  registerAndLogin,
} from "./helpers/ai-studio-live-auth.js";

const sourceImage = fileURLToPath(
  new URL(
    "../public/products/cute-flexi-baby-dragon/preview_reference.png",
    import.meta.url,
  ),
);
const TEST_ONLY_PASSWORD = "TEST_ONLY_ci_password_2026";

test("real HTTP G2: reauthentication, idempotent pipeline replay, rendered GLB and fail-closed Print Readiness", async ({
  page,
}, testInfo) => {
  const idea = `TEST_ONLY real AI Studio ${randomUUID()}`;
  const browserErrors = [];
  const webglErrors = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      /webgl|three|shader/i.test(message.text())
    )
      webglErrors.push(message.text());
  });

  await page.setViewportSize({ width: 1440, height: 950 });
  const { email } = await registerAndLogin(page);
  await page.goto("/studio");

  await page.getByRole("tab", { name: "Image to 3D" }).click();
  await page
    .getByLabel("Choose a PNG, JPEG or WebP reference image")
    .setInputFiles(sourceImage);
  await page.getByRole("button", { name: "Tượng 3D" }).click();
  await page.getByLabel("Mô tả bổ sung (không bắt buộc)").fill(idea);
  await page.getByRole("button", { name: "Lưu dự án" }).click();
  await expect(
    page.getByText("Đã đọc dự án đã được Backend xác nhận."),
  ).toBeVisible({ timeout: 30_000 });
  const projectId = new URL(page.url()).searchParams.get("projectId");
  expect(projectId).toMatch(/^[0-9a-f-]{36}$/i);

  await page.goto("/studio");
  const historyItem = page.getByRole("button", { name: new RegExp(idea) });
  await expect(historyItem).toBeVisible({ timeout: 20_000 });
  await historyItem.click();
  await expect(page).toHaveURL(new RegExp(`projectId=${projectId}`));
  await expect(
    page.getByText("Đã đọc dự án đã được Backend xác nhận."),
  ).toBeVisible({ timeout: 20_000 });

  await expect(
    page.getByRole("heading", { name: "Design Pipeline" }),
  ).toBeVisible();
  const referenceCommand = await captureIdempotentCommand(
    page,
    "/references/generate",
    () => page.getByRole("button", { name: "Tạo ảnh tham chiếu" }).click(),
  );
  await expect(
    page.getByRole("img", { name: "Ảnh tham chiếu front" }),
  ).toBeVisible({ timeout: 45_000 });
  await page.getByRole("button", { name: "Duyệt ảnh tham chiếu" }).click();

  const modelPayload = {
    referenceVersionId: referenceCommand.response.versionId,
    revisionFeedback: null,
  };
  const modelCommand = await captureIdempotentCommand(
    page,
    "/models/generate",
    () => page.getByRole("button", { name: "Tạo model 3D" }).click(),
  );
  expect(modelCommand.payload).toEqual(modelPayload);

  const modelViewer = page.getByTestId("design-project-model-viewer");
  const canvas = modelViewer.locator("canvas");
  await expect(canvas).toBeVisible({ timeout: 60_000 });
  await expect(
    page.getByText(
      "Artifact GLB đã parse, có mesh hình học hợp lệ và tải thành công trong Viewer.",
    ),
  ).toBeVisible();
  await expect(modelViewer.locator(".ai-studio__viewer-loading")).toHaveCount(
    0,
  );
  const canvasState = await canvas.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    const context = element.getContext("webgl2") || element.getContext("webgl");
    return {
      width: element.width,
      height: element.height,
      visibleWidth: bounds.width,
      visibleHeight: bounds.height,
      hasWebGlContext: Boolean(context),
      contextLost: context?.isContextLost() ?? true,
    };
  });
  expect(canvasState.width).toBeGreaterThan(0);
  expect(canvasState.height).toBeGreaterThan(0);
  expect(canvasState.visibleWidth).toBeGreaterThan(300);
  expect(canvasState.visibleHeight).toBeGreaterThan(300);
  expect(canvasState.hasWebGlContext).toBe(true);
  expect(canvasState.contextLost).toBe(false);
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
  const evidenceDirectory = process.env.CI_EVIDENCE_DIR || testInfo.outputDir;
  await mkdir(evidenceDirectory, { recursive: true });
  const screenshotPath = join(evidenceDirectory, "threejs-rendered-glb.png");
  await canvas.screenshot({
    path: screenshotPath,
    animations: "disabled",
    caret: "hide",
  });

  const readinessResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "GET" &&
      response.url().endsWith("/print-readiness"),
  );
  await page.getByRole("button", { name: "Duyệt model" }).click();
  const readiness = await (await readinessResponse).json();
  expect(readiness.printReadiness).toBe("NOT_READY");
  expect(readiness.reasonCode).toBe("DIMENSION_EVIDENCE_MISSING");
  await expect(
    page.getByRole("button", { name: "Mở chuẩn bị cấu hình in" }),
  ).toBeDisabled();

  expect(browserErrors).toEqual([]);
  expect(webglErrors).toEqual([]);
  await page.reload();
  await expect(
    page.getByText("Đã đọc dự án đã được Backend xác nhận."),
  ).toBeVisible({ timeout: 20_000 });
  await expect(
    page.getByRole("button", { name: "Mở chuẩn bị cấu hình in" }),
  ).toBeDisabled();

  // Log out through the real app, sign back in, then reopen the same owner-scoped history item.
  await page.getByRole("button", { name: "Tài khoản" }).click();
  await page.getByRole("button", { name: "Đăng xuất" }).click();
  await expect(page.getByRole("link", { name: "Đăng nhập" })).toBeVisible();
  await loginExistingAccount(page, email, TEST_ONLY_PASSWORD);
  const restoredInputResponses = [];
  page.on("response", async (response) => {
    if (
      !response.url().includes(`/projects/${projectId}/inputs/`) ||
      !response.url().endsWith("/content")
    )
      return;
    try {
      restoredInputResponses.push(await response.body());
    } catch {
      /* the assertion below reports a missing restored input */
    }
  });
  await page.goto("/studio");
  const restoredHistoryItem = page.getByRole("button", {
    name: new RegExp(idea),
  });
  await expect(restoredHistoryItem).toBeVisible({ timeout: 20_000 });
  await restoredHistoryItem.click();
  await expect(page).toHaveURL(new RegExp(`projectId=${projectId}`));
  await expect(
    page.getByText("Đã đọc dự án đã được Backend xác nhận."),
  ).toBeVisible({ timeout: 20_000 });
  await expect(
    page.getByRole("heading", { name: "Design Pipeline" }),
  ).toBeVisible();

  const timeline = page.getByRole("region", { name: "Project Timeline" });
  await expect(timeline).toContainText("PROJECT CREATED");
  await expect(timeline).toContainText("REFERENCE VERSION");
  await expect(timeline).toContainText("REFERENCE APPROVAL");
  await expect(timeline).toContainText("MODEL VERSION");
  await expect(timeline).toContainText("MODEL APPROVAL");
  const expectedSourceSha = createHash("sha256")
    .update(await readFile(sourceImage))
    .digest("hex");
  await expect
    .poll(() => restoredInputResponses.length, { timeout: 10_000 })
    .toBe(1);
  const restoredSourceSha = createHash("sha256")
    .update(restoredInputResponses[0])
    .digest("hex");
  expect(restoredSourceSha).toBe(expectedSourceSha);

  // Replay both accepted commands with their original idempotency keys after reauthentication.
  const referenceReplay = await replayIdempotentCommand(
    page,
    projectId,
    "references/generate",
    referenceCommand,
  );
  const modelReplay = await replayIdempotentCommand(
    page,
    projectId,
    "models/generate",
    modelCommand,
  );
  expect(referenceReplay.jobId).toBe(referenceCommand.response.jobId);
  expect(referenceReplay.versionId).toBe(referenceCommand.response.versionId);
  expect(modelReplay.jobId).toBe(modelCommand.response.jobId);
  expect(modelReplay.versionId).toBe(modelCommand.response.versionId);

  const evidenceResponse = await page.evaluate(async (project) => {
    const token = localStorage.getItem("morphia_access_token");
    const response = await fetch(
      `/api/ci-test/projects/${encodeURIComponent(project)}/evidence`,
      {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      },
    );
    return { status: response.status, body: await response.json() };
  }, projectId);
  expect(evidenceResponse.status).toBe(200);
  const pipelineEvidence = evidenceResponse.body;
  expect(pipelineEvidence.sqlJobs).toHaveLength(2);
  expect(
    pipelineEvidence.sqlJobs.filter((job) => job.stage === "REFERENCE_IMAGE"),
  ).toHaveLength(1);
  expect(
    pipelineEvidence.sqlJobs.filter((job) => job.stage === "MODEL_MESH"),
  ).toHaveLength(1);
  expect(pipelineEvidence.referenceProviderCalls).toBe(1);
  expect(pipelineEvidence.modelProviderSubmitCalls).toBe(1);
  expect(
    pipelineEvidence.sqlJobs.every(
      (job) => job.status === "COMPLETED" && job.attemptCount >= 1,
    ),
  ).toBe(true);

  await writeFile(
    join(evidenceDirectory, "g2-evidence.json"),
    JSON.stringify(
      {
        reauthenticatedProjectRestore: true,
        timelineEventsVerified: 5,
        sourceImageSha256Matched: true,
        idempotentReplay: {
          referenceReturnedSameJobAndVersion: true,
          modelReturnedSameJobAndVersion: true,
          sqlJobs: pipelineEvidence.sqlJobs.map(
            ({ stage, status, attemptCount }) => ({
              stage,
              status,
              attemptCount,
            }),
          ),
          providerCalls: {
            reference: pipelineEvidence.referenceProviderCalls,
            modelSubmit: pipelineEvidence.modelProviderSubmitCalls,
          },
        },
        threeJs: { ...canvasState, screenshot: "threejs-rendered-glb.png" },
        printReadiness: {
          result: readiness.printReadiness,
          reasonCode: readiness.reasonCode,
        },
      },
      null,
      2,
    ),
  );
});

test("real HTTP G2: MULTI project history restores ordered source files after reauthentication", async ({
  page,
}) => {
  const sourceSha = createHash("sha256")
    .update(await readFile(sourceImage))
    .digest("hex");
  const { email } = await registerAndLogin(page);
  await page.goto("/studio");

  await page.getByRole("tab", { name: "Nhiều góc ảnh" }).click();
  await page.getByLabel("Choose Trước view").setInputFiles(sourceImage);
  await page.getByLabel("Choose Trái view").setInputFiles(sourceImage);
  await page.getByRole("button", { name: "Tượng 3D" }).click();
  await page.getByRole("button", { name: "Lưu dự án" }).click();
  await expect(
    page.getByText("Đã đọc dự án đã được Backend xác nhận."),
  ).toBeVisible({ timeout: 30_000 });
  const projectId = new URL(page.url()).searchParams.get("projectId");
  expect(projectId).toMatch(/^[0-9a-f-]{36}$/i);

  await page.getByRole("button", { name: "Tài khoản" }).click();
  await page.getByRole("button", { name: "Đăng xuất" }).click();
  await expect(page.getByRole("link", { name: "Đăng nhập" })).toBeVisible();
  await loginExistingAccount(page, email, TEST_ONLY_PASSWORD);
  await page.goto("/studio");
  const historyItem = page
    .getByRole("button", { name: /figure · multi/i })
    .first();
  await expect(historyItem).toBeVisible({ timeout: 20_000 });
  await historyItem.click();
  await expect(page).toHaveURL(new RegExp(`projectId=${projectId}`));
  await expect(
    page.getByText("Đã đọc dự án đã được Backend xác nhận."),
  ).toBeVisible({ timeout: 20_000 });

  for (const alt of ["Trước view", "Trái view"]) {
    const imageBytes = await page
      .locator(`img[alt="${alt}"]`)
      .evaluate(async (image) =>
        Array.from(
          new Uint8Array(await (await fetch(image.src)).arrayBuffer()),
        ),
      );
    expect(
      createHash("sha256").update(Buffer.from(imageBytes)).digest("hex"),
    ).toBe(sourceSha);
  }
});

async function captureIdempotentCommand(page, routeSuffix, trigger) {
  const requestPromise = page.waitForRequest(
    (request) =>
      request.method() === "POST" && request.url().includes(routeSuffix),
  );
  const responsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().includes(routeSuffix),
  );
  await trigger();
  const request = await requestPromise;
  const response = await responsePromise;
  expect(response.status()).toBe(202);
  return {
    idempotencyKey: request.headers()["idempotency-key"],
    payload: request.postDataJSON(),
    response: await response.json(),
  };
}

async function replayIdempotentCommand(page, projectId, route, command) {
  const result = await page.evaluate(
    async ({ project, endpoint, key, payload }) => {
      const token = localStorage.getItem("morphia_access_token");
      const response = await fetch(
        `/api/ai-studio/projects/${encodeURIComponent(project)}/${endpoint}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": key,
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(payload),
        },
      );
      return { status: response.status, body: await response.json() };
    },
    {
      project: projectId,
      endpoint: route,
      key: command.idempotencyKey,
      payload: command.payload,
    },
  );
  expect([200, 202]).toContain(result.status);
  return result.body;
}
