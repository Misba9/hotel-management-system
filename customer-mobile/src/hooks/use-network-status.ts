import NetInfo from "@react-native-community/netinfo";
import { useEffect, useState } from "react";

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      setIsOnline(state.isConnected !== false && state.isInternetReachable !== false);
    });
    void NetInfo.fetch().then((state) => {
      setIsOnline(state.isConnected !== false && state.isInternetReachable !== false);
    });
    return () => unsub();
  }, []);

  return { isOnline };
}
