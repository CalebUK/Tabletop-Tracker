# Firebase setup — Online Library

The app uses Firebase (Firestore + anonymous auth) for the optional **online
library** feature. Project config lives in `src/lib/firebaseConfig.ts` (the web
config is public by design — security is enforced by the rules below).

## ⚠️ Required: publish the security rules

You created Firestore in **production mode**, which denies everything by
default. The library feature will not work until you paste these rules in.

1. Firebase console → **Firestore Database → Rules**.
2. Replace everything with the rules below.
3. Click **Publish**.

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // A shared library lives at /libraries/{shareCode}.
    match /libraries/{code} {
      // Anyone who knows the share code (the document id) can read it.
      allow read: if true;

      // Only a signed-in user can create a library, and only as its owner.
      allow create: if request.auth != null
                    && request.resource.data.ownerUid == request.auth.uid;

      // Only the owner can delete their own library.
      allow delete: if request.auth != null
                    && resource.data.ownerUid == request.auth.uid;

      // The owner can fully update; anyone viewing may bump the view counter by
      // exactly 1 (and change nothing else).
      allow update: if (request.auth != null && resource.data.ownerUid == request.auth.uid)
                    || (
                      request.resource.data.diff(resource.data).affectedKeys().hasOnly(['views'])
                      && request.resource.data.views == resource.data.get('views', 0) + 1
                    );
    }
  }
}
```

> If you've already published the earlier rules, **re-publish** with this updated
> version — the new `update` rule is what lets the view counter work.

These rules mean: libraries can only be reached by knowing the exact share code
(they aren't listable or searchable), and only the device that created a library
can change or delete it.

## What's stored

Per library document: a display name, the owner's anonymous user id, and a list
of `{ name, rating, minPlayers, maxPlayers, playTimeMin }`. **No photos, emails,
or personal details.** A 6-character random share code is the access control.

## Free tier

Firestore's free (Spark) tier — 1 GiB storage, 50k reads/day, 20k writes/day —
comfortably covers personal/friend use. Game lists are tiny (text only).

## Note for builds

The library uses `@react-native-async-storage/async-storage` (native) to keep a
device's anonymous login persistent, so enabling this feature requires a native
rebuild (the build after this change).
