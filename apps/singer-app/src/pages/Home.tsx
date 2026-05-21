import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonCard, IonCardContent, IonCardHeader, IonCardTitle, IonIcon, IonButton } from '@ionic/react'
import { compass, musicalNotes, micOutline } from 'ionicons/icons'

const Home: React.FC = () => (
  <IonPage>
    <IonHeader translucent>
      <IonToolbar>
        <IonTitle>
          <span className="singr-gradient-text" style={{ fontWeight: 700 }}>Singr</span>
        </IonTitle>
      </IonToolbar>
    </IonHeader>
    <IonContent fullscreen className="ion-padding">
      <div style={{ textAlign: 'center', paddingTop: '2rem' }}>
        <IonIcon icon={micOutline} style={{ fontSize: '4rem', color: 'var(--ion-color-primary)' }} />
        <h1 className="singr-gradient-text" style={{ fontSize: '2rem', fontWeight: 700, margin: '1rem 0 0.5rem' }}>
          Welcome to Singr
        </h1>
        <p style={{ color: 'var(--ion-color-step-600)', maxWidth: '320px', margin: '0 auto 2rem' }}>
          Find karaoke venues near you, browse songs, and submit your requests — all from your phone.
        </p>
      </div>

      <IonCard className="singr-card-glow">
        <IonCardHeader>
          <IonIcon icon={compass} style={{ fontSize: '2rem', color: 'var(--ion-color-tertiary)' }} />
          <IonCardTitle style={{ marginTop: '0.5rem' }}>Nearby Venues</IonCardTitle>
        </IonCardHeader>
        <IonCardContent>
          <p style={{ color: 'var(--ion-color-step-600)' }}>
            Discover karaoke nights happening near you. See live status, song catalogs, and queue length.
          </p>
          <IonButton expand="block" color="primary" style={{ marginTop: '1rem' }} disabled>
            Coming Soon
          </IonButton>
        </IonCardContent>
      </IonCard>

      <IonCard className="singr-card-glow">
        <IonCardHeader>
          <IonIcon icon={musicalNotes} style={{ fontSize: '2rem', color: 'var(--ion-color-secondary)' }} />
          <IonCardTitle style={{ marginTop: '0.5rem' }}>Quick Request</IonCardTitle>
        </IonCardHeader>
        <IonCardContent>
          <p style={{ color: 'var(--ion-color-step-600)' }}>
            Already at a venue? Search the song catalog and submit your request instantly — no sign-up required.
          </p>
          <IonButton expand="block" color="secondary" style={{ marginTop: '1rem' }} disabled>
            Coming Soon
          </IonButton>
        </IonCardContent>
      </IonCard>
    </IonContent>
  </IonPage>
)

export default Home
