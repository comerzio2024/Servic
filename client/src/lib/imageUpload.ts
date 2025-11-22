export async function uploadImage(file: File): Promise<string> {
  const uploadRes = await fetch('/api/objects/upload', {
    method: 'POST',
    credentials: 'include',
  });

  if (!uploadRes.ok) {
    throw new Error('Failed to get upload URL');
  }

  const { uploadURL } = await uploadRes.json();

  const uploadResponse = await fetch(uploadURL, {
    method: 'PUT',
    body: file,
    headers: {
      'Content-Type': file.type,
    },
  });

  if (!uploadResponse.ok) {
    throw new Error('Failed to upload image');
  }

  const setAclRes = await fetch('/api/service-images', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({ imageURL: uploadURL }),
  });

  if (!setAclRes.ok) {
    throw new Error('Failed to set image ACL');
  }

  const { objectPath } = await setAclRes.json();
  return objectPath;
}
