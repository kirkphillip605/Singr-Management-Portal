import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonButton, IonIcon, IonAvatar } from '@ionic/react'
import { personCircleOutline, logInOutline } from 'ionicons/icons'

const Profile: React.FC = () => (
  <IonPage>
    <IonHeader translucent>
      <IonToolbar>
        <IonTitle>Profile</IonTitle>
      </IonToolbar>
    </IonHeader>
    <IonContent fullscreen className="ion-padding">
      <div style={{ textAlign: 'center', paddingTop: '3rem' }}>
        <IonAvatar style={{ width: '100px', height: '100px', margin: '0 auto', background: 'var(--ion-color-step-200)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <IonIcon icon={personCircleOutline} style={{ fontSize: '4rem', color: 'var(--ion-color-step-500)' }} />
        </IonAvatar>

        <h2 style={{ color: 'var(--ion-text-color)', marginTop: '1.5rem', fontWeight: 600 }}>
          Guest Singer
        </h2>
        <p style={{ color: 'var(--ion-color-step-500)', maxWidth: '300px', margin: '0.5rem auto 2rem', fontSize: '0.95rem' }}>
          Sign in to save your favorites, track your request history, and personalize your karaoke experience.
        </p>

        <IonButton expand="block" color="primary" style={{ maxWidth: '300px', margin: '0 auto' }} disabled>
          <IonIcon icon={logInOutline} slot="start" />
          Sign In / Create Account
        </IonButton>

        <p style={{ color: 'var(--ion-color-step-400)', fontSize: '0.8rem', marginTop: '2rem' }}>
          You can browse venues and submit requests without an account.
        </p>
      </div>
    </IonContent>
  </IonPage>
)

export default Profile
