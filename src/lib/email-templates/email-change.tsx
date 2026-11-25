import * as React from 'react'
import { Body, Button, Container, Head, Heading, Html, Link, Preview, Text } from '@react-email/components'

interface EmailChangeEmailProps {
  siteName: string
  oldEmail: string
  email: string
  newEmail: string
  confirmationUrl: string
}

export const EmailChangeEmail = ({ siteName, oldEmail, newEmail, confirmationUrl }: EmailChangeEmailProps) => (
  <Html lang="sv" dir="ltr">
    <Head />
    <Preview>Bekräfta din nya e-postadress för {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Bekräfta byte av e-post</Heading>
        <Text style={text}>
          Du har begärt att byta e-postadress för {siteName} från{' '}
          <Link href={`mailto:${oldEmail}`} style={link}>{oldEmail}</Link> till{' '}
          <Link href={`mailto:${newEmail}`} style={link}>{newEmail}</Link>.
        </Text>
        <Text style={text}>Klicka på knappen nedan för att bekräfta ändringen.</Text>
        <Button style={button} href={confirmationUrl}>Bekräfta ny e-post</Button>
        <Text style={footer}>Om du inte har begärt ändringen bör du skydda ditt konto omedelbart.</Text>
      </Container>
    </Body>
  </Html>
)

export default EmailChangeEmail

const main = { backgroundColor: '#ffffff', fontFamily: 'Montserrat, Arial, sans-serif' }
const container = { padding: '20px 25px' }
const h1 = { fontSize: '22px', fontWeight: 800, color: '#303465', margin: '0 0 20px' }
const text = { fontSize: '14px', color: '#55586F', lineHeight: '1.5', margin: '0 0 25px' }
const link = { color: '#303465', textDecoration: 'underline' }
const button = {
  backgroundColor: '#C21883', color: '#ffffff', fontSize: '14px', fontWeight: 600,
  border: '1px solid #C21883', borderRadius: '6px', padding: '12px 20px', textDecoration: 'none',
}
const footer = { fontSize: '12px', color: '#55586F', margin: '30px 0 0' }
