import React, { useState } from "react";
import { 
  useAuthModal, 
  useUser, 
  useSigner, 
  useLogout,
  useSmartAccountClient
} from "@account-kit/react";
import { formatEther } from "viem";

export default function App() {
  const { openAuthModal } = useAuthModal();
  const user = useUser();
  const { logout } = useLogout();
  const signer = useSigner();
  const { client } = useSmartAccountClient({
    type: "LightAccount", // or MultiOwnerLightAccount
  });

  const [isSigning, setIsSigning] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);

  // Sign message using Alchemy Signer
  const handleSignMessage = async () => {
    if (!signer) return;
    setIsSigning(true);
    try {
      const message = "Hello from Alchemy Account Kit!";
      const sig = await signer.signMessage(message);
      setSignature(sig);
      console.log("Signature:", sig);
    } catch (error) {
      console.error("Signing failed:", error);
    } finally {
      setIsSigning(false);
    }
  };

  const handleLogin = () => {
    const apiKey = import.meta.env.VITE_ALCHEMY_API_KEY;
    console.log("Attempting login...");
    if (!apiKey || apiKey === "YOUR_ALCHEMY_API_KEY") {
      alert("Error: VITE_ALCHEMY_API_KEY is not set in .env file!");
      return;
    }
    
    // Provide a callback to catch errors if openAuthModal supports it, 
    // or just try/catch if it returns a promise (it usually doesn't, but safely wrapping)
    try {
      openAuthModal();
    } catch (e) {
      console.error("Failed to open auth modal:", e);
      alert("Failed to open login modal. Check console for details.");
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-gray-800 rounded-xl shadow-2xl p-8 border border-gray-700">
        <h1 className="text-3xl font-bold mb-8 text-center bg-gradient-to-r from-blue-400 to-purple-500 text-transparent bg-clip-text">
          Passkey PoC
        </h1>
        
        {!user ? (
          <div className="flex flex-col gap-4">
            <p className="text-gray-400 text-center mb-4">
              Log in with Email or Passkey using Alchemy Account Kit.
            </p>
            <button
              onClick={handleLogin}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition duration-200 transform hover:scale-[1.02]"
            >
              Login
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <div className="bg-gray-700/50 p-4 rounded-lg">
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">User Info</h2>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-400">Email:</span>
                  <span className="text-white truncate max-w-[200px]">{user.email || "No Email"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">User Address:</span>
                  <span className="text-white font-mono text-xs truncate max-w-[200px]">{user.address}</span>
                </div>
                {client && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Smart Account:</span>
                    <span className="text-white font-mono text-xs truncate max-w-[200px]">{client.account.address}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={handleSignMessage}
                disabled={isSigning}
                className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg transition duration-200"
              >
                {isSigning ? "Signing..." : "Sign Message"}
              </button>
              
              <button
                onClick={() => logout()}
                className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-6 rounded-lg transition duration-200"
              >
                Logout
              </button>
            </div>

            {signature && (
              <div className="bg-green-900/30 p-4 rounded-lg border border-green-800">
                <h3 className="text-green-400 font-semibold mb-2">Signature Created!</h3>
                <p className="font-mono text-xs text-green-200 break-all">{signature}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
