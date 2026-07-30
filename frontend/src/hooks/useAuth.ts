import { useEffect, useState } from "react";
import { fetchMe } from "../api/client";
import { User } from "../types";

export function useAuth() {
  const [user, setUser] = useState<User | null | undefined>(undefined); // undefined = loading

  useEffect(() => {
    fetchMe().then(setUser);
  }, []);

  return { user, setUser, isLoading: user === undefined };
}
