import {
  passkeyActions,
  signOut,
  twoFactorActions,
  useListPasskeys,
  useSession,
  revokeSession,
  updateUser,
} from "@/lib/auth-client";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import type { Session, User } from "better-auth/types";
import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "./ui/button";
import {
  KeyRound,
  Laptop,
  Loader2,
  LogOut,
  Smartphone,
  Trash2,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import { toast } from "sonner";
import type { ActiveSession } from "@/types";

export function UserCard(props: {
  activeSessions: Session[];
  initialSession: ActiveSession | null;
}) {
  const { activeSessions, initialSession } = props;
  const [session, setSession] = useState(initialSession);
  const { data } = useSession();

  useEffect(() => {
    if (data) {
      setSession(data);
    }
  }, [data]);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>User</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-8">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="grid gap-1">
              <p className="text-sm leading-none font-medium">
                {session?.user.name}
              </p>
              <p className="text-sm">{session?.user.email}</p>
              <p className="text-sm">User ID: {session?.user.id}</p>
            </div>
          </div>
          <EditUserDialog user={session?.user} />
        </div>
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            className="gap-2"
            onClick={async () => {
              await signOut();
              window.location.reload();
            }}
          >
            <LogOut />
            Sign Out
          </Button>
          <div>
            <TwoFactorDialog enabled={session?.user.twoFactorEnabled} />
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-y py-4">
          <div className="flex flex-col gap-2">
            <p className="text-sm">Passkeys</p>
            <div className="flex flex-wrap gap-2">
              <AddPasskeyDialog />
              <ListPasskeys />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function EditUserDialog(props: { user?: User }) {
  const { user } = props;
  const [isLoading, setIsLoading] = useState(false);
  const [image, setImage] = useState<File | undefined>();
  const [name, setName] = useState<string | undefined>();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Dialog onOpenChange={setIsOpen} open={isOpen}>
      <DialogTrigger>
        <Button variant="secondary">Edit User</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit User</DialogTitle>
          <DialogDescription>Edit User Information</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Label htmlFor="full-name">Full Name</Label>
          <Input
            placeholder={user?.name}
            type="text"
            value={name || ""}
            onInput={(e) => {
              if ("value" in e.target) setName(e.target.value as string);
            }}
          />
        </div>
        <DialogFooter>
          <Button
            onClick={async () => {
              setIsLoading(true);
              await updateUser({
                name: name,
                fetchOptions: {
                  onResponse(context) {
                    setIsLoading(false);
                  },
                  onError(context) {
                    alert(context.error.message);
                  },
                  onSuccess() {
                    alert("User Updated Successfully");
                    setIsOpen(false);
                  },
                },
              });
            }}
          >
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <p>Update</p>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddPasskeyDialog() {
  const [name, setName] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  return (
    <Dialog>
      <DialogTrigger>
        <Button variant="outline">Add Passkey</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Register New Passkey</DialogTitle>
          <DialogDescription>
            Add a new passkey to your account
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Label htmlFor="passkey-name">Passkey Name (optional)</Label>
          <Input
            type="text"
            placeholder="My Passkey"
            value={name}
            onInput={(e) => {
              if ("value" in e.target) setName(e.target.value as string);
            }}
          />
        </div>
        <DialogFooter>
          <Button
            onClick={async () => {
              const res = await passkeyActions.addPasskey({
                name: name,
                fetchOptions: {
                  onSuccess() {
                    alert("Successfully added");
                    setName("");
                  },
                },
              });
              if (res?.error) {
                alert(res.error.message);
              }
            }}
          >
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <div className="flex items-center gap-2">
                <KeyRound />
                Add Passkey
              </div>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ListPasskeys() {
  const { data: passkeysData } = useListPasskeys();
  const [isDeletePasskey, setIsDeletePasskey] = useState(false);

  return (
    <Dialog>
      <DialogTrigger>
        <Button variant="outline">
          Passkeys {passkeysData?.length ? `[${passkeysData?.length}]` : ""}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Passkeys</DialogTitle>
          <DialogDescription>List of passkeys</DialogDescription>
        </DialogHeader>
        {passkeysData?.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {passkeysData?.map((passkey) => (
                <TableRow
                  key={passkey.id}
                  className="flex items-center justify-between"
                >
                  <TableCell>{passkey.name || "My Passkey"}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="destructive"
                      onClick={async () => {
                        const res = await passkeyActions.deletePasskey({
                          id: passkey.id,
                          fetchOptions: {
                            onRequest: () => {
                              setIsDeletePasskey(true);
                            },
                            onSuccess: () => {
                              toast.success("Passkey deleted successfully");
                              setIsDeletePasskey(false);
                            },
                            onError: (error) => {
                              alert(error.error.message);
                              setIsDeletePasskey(false);
                            },
                          },
                        });
                      }}
                    >
                      {isDeletePasskey ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 />
                      )}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-muted-foreground text-sm">No passkeys found</p>
        )}
      </DialogContent>
    </Dialog>
  );
}

function TwoFactorDialog(props: { enabled?: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const [password, setPassword] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(false);

  return (
    <Dialog onOpenChange={setIsOpen} open={isOpen}>
      <DialogTrigger>
        <Button variant="secondary">
          {props.enabled ? "Disable 2FA" : "Enable 2FA"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enable Two Factor</DialogTitle>
          <DialogDescription>
            Enable two factor authentication
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Label htmlFor="password">Password</Label>
          <Input
            type="password"
            placeholder="Password"
            value={password || ""}
            onInput={(e) => {
              if ("value" in e.target) setPassword(e.target.value as string);
            }}
          />
        </div>
        <DialogFooter>
          <Button
            onClick={async () => {
              if (!password) {
                alert("Password is required!");
                return;
              }
              setIsLoading(true);
              if (props.enabled) {
                await twoFactorActions.disable({
                  password: password,
                  fetchOptions: {
                    onResponse(context) {
                      setIsLoading(false);
                    },
                    onError(context) {
                      alert(context.error.message);
                    },
                    onSuccess() {
                      alert("Two factor is disabled!");
                      setIsOpen(false);
                    },
                  },
                });
                return;
              }
              await twoFactorActions.enable({
                password: password,
                fetchOptions: {
                  onResponse(context) {
                    setIsLoading(false);
                  },
                  onError(context) {
                    alert(context.error.message);
                  },
                  onSuccess() {
                    toast.success("Two factor successfully enabled!");
                    setIsOpen(false);
                  },
                },
              });
            }}
          >
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <p>{props.enabled ? "Disable" : "Enable"}</p>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
