import * as React from 'react'
import { Body, Container, Head, Heading, Html, Preview, Text } from '@react-email/components'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <Html lang="sv" dir="ltr">
    <Head />
    <Preview>Din verifieringskod</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Bekräfta din identitet</Heading>
        <Text style={text}>Använd koden nedan för att bekräfta din identitet:</Text>
        <Text style={codeStyle}>{token}</Text>
        <Text style={footer}>Koden går snart ut. Om du inte har begärt den kan du ignorera mejlet.</Text>
      </Container>
    </Body>
  </Html>
)

export default ReauthenticationEmail

const main = { backgroundColor: '#ffffff', fontFamily: 'Montserrat, Arial, sans-serif' }
const container = { padding: '20px 25px' }
const h1 = { fontSize: '22px', fontWeight: 800, color: '#303465', margin: '0 0 20px' }
const text = { fontSize: '14px', color: '#55586F', lineHeight: '1.5', margin: '0 0 25px' }
const codeStyle = {
  fontFamily: 'Courier, monospace', fontSize: '22px', fontWeight: 'bold' as const,
  color: '#303465', margin: '0 0 30px',
}
const footer = { fontSize: '12px', color: '#55586F', margin: '30px 0 0' }
