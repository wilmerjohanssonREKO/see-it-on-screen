import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from "@react-email/components";
type Props = { schoolName?: string; memberType?: string; inviteUrl?: string };
export function SchoolInvitation({
  schoolName = "din skola",
  memberType = "teacher",
  inviteUrl = "https://example.invalid/inbjudan",
}: Props) {
  return (
    <Html lang="sv">
      <Head />
      <Preview>Personlig inbjudan till {schoolName} på REKO UF</Preview>
      <Body
        style={{ fontFamily: "Arial,sans-serif", backgroundColor: "#F5F3F7", color: "#303465" }}
      >
        <Container style={{ padding: "32px", backgroundColor: "#FFFFFF" }}>
          <Heading>Välkommen till REKO UF</Heading>
          <Text>
            REKO har bjudit in dig som {memberType === "teacher" ? "lärare" : "skolansvarig"} för{" "}
            {schoolName}.
          </Text>
          <Text>
            Öppna din personliga länk och verifiera samma e-postadress som fick inbjudan. Länken kan
            användas en gång och gäller i 48 timmar.
          </Text>
          <Button
            href={inviteUrl}
            style={{
              backgroundColor: "#303465",
              color: "#FFFFFF",
              padding: "12px 20px",
              borderRadius: 6,
            }}
          >
            Acceptera inbjudan
          </Button>
          <Text>
            Har du inte väntat dig inbjudan kan du ignorera mejlet. Frågor? Svara till
            hej@rekoweb.com.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
export const template = {
  component: SchoolInvitation,
  subject: "Din personliga inbjudan till REKO UF",
  displayName: "Skol- och lärarinbjudan",
  previewData: {
    schoolName: "Exempelskolan",
    memberType: "teacher",
    inviteUrl: "https://example.invalid/inbjudan",
  },
};
