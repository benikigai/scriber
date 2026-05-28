import { linear } from './linear';

/**
 * Linear 3-step file attachment:
 *  1. fileUpload GraphQL → returns uploadUrl + assetUrl + headers
 *  2. PUT bytes to uploadUrl with those headers
 *  3. attachmentCreate GraphQL with assetUrl
 *
 * Returns the asset URL (Linear-hosted) which is also visible on the issue.
 */
export async function attachBytesToIssue(opts: {
  issueIdentifier: string;   // e.g. "BEN-12"
  bytes: Buffer;
  filename: string;
  contentType: string;
  title: string;
}): Promise<{ assetUrl: string; attachmentId?: string }> {
  const client = linear();

  // Step 1 — fileUpload
  const uploadRes = await client.fileUpload(
    opts.contentType,
    opts.filename,
    opts.bytes.length,
  );
  if (!uploadRes.success || !uploadRes.uploadFile) {
    throw new Error('Linear fileUpload returned failure');
  }
  const { uploadUrl, assetUrl, headers } = uploadRes.uploadFile;

  // Step 2 — PUT bytes
  const headerObj: Record<string, string> = { 'Content-Type': opts.contentType };
  for (const h of headers ?? []) {
    if (h.key && h.value) headerObj[h.key] = h.value;
  }
  const putRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: headerObj,
    body: opts.bytes as any,
  });
  if (!putRes.ok) {
    throw new Error(`Linear PUT to uploadUrl failed: ${putRes.status} ${putRes.statusText}`);
  }

  // Step 3 — attachmentCreate against the issue (resolve identifier -> id)
  const issue = await client.issue(opts.issueIdentifier);
  const att = await client.createAttachment({
    issueId: issue.id,
    title: opts.title,
    url: assetUrl,
  });
  const attachment = await att.attachment;
  return { assetUrl, attachmentId: attachment?.id };
}
