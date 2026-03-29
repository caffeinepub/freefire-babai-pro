import { Ed25519KeyIdentity } from "@dfinity/identity";
import type { Identity } from "@icp-sdk/core/agent";
import { useEffect, useState } from "react";

const STORAGE_KEY = "ff_stable_identity_v1";

export function useStableIdentity(): Identity | undefined {
  const [identity, setIdentity] = useState<Identity | undefined>(undefined);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      let keyIdentity: Ed25519KeyIdentity;

      if (stored) {
        try {
          const parsed = JSON.parse(stored) as [string, string];
          keyIdentity = Ed25519KeyIdentity.fromParsedJson(parsed);
        } catch {
          localStorage.removeItem(STORAGE_KEY);
          keyIdentity = Ed25519KeyIdentity.generate();
          localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(keyIdentity.toJSON()),
          );
        }
      } else {
        keyIdentity = Ed25519KeyIdentity.generate();
        localStorage.setItem(STORAGE_KEY, JSON.stringify(keyIdentity.toJSON()));
      }

      setIdentity(keyIdentity);
    } catch (err) {
      console.error("useStableIdentity: failed to load/generate identity", err);
    }
  }, []);

  return identity;
}
