import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AddressFields({
  values,
  prefix = "address",
}: {
  values?: { street_address?: string | null; postal_code?: string | null; city?: string | null };
  prefix?: string;
}) {
  return (
    <>
      <div className="grid gap-2 sm:col-span-2">
        <Label htmlFor={`${prefix}-street`}>Gatuadress</Label>
        <Input
          id={`${prefix}-street`}
          name="street_address"
          defaultValue={values?.street_address ?? ""}
          required
          maxLength={200}
          autoComplete="street-address"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`${prefix}-postal`}>Postnummer</Label>
        <Input
          id={`${prefix}-postal`}
          name="postal_code"
          defaultValue={values?.postal_code ?? ""}
          required
          pattern="[0-9]{3} ?[0-9]{2}"
          maxLength={6}
          inputMode="numeric"
          autoComplete="postal-code"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`${prefix}-city`}>Ort</Label>
        <Input
          id={`${prefix}-city`}
          name="city"
          defaultValue={values?.city ?? ""}
          required
          maxLength={120}
          autoComplete="address-level2"
        />
      </div>
    </>
  );
}
