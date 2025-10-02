// app/hooks/useProfileGuard.ts
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

const useProfileGuard = () => {
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) return;

      const snap = await getDoc(doc(db, "users", user.uid));
      if (!snap.exists() || !snap.data().profileCompleted || !snap.data().photoUrl || !snap.data().gender || snap.data().location?.lat === 0) {
        router.push("/profile/setup");
      }
    });

    return () => unsubscribe(); // Clean up the listener
  }, []);
};

export default useProfileGuard;
