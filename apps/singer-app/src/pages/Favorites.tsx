import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonIcon } from '@ionic/react'
import { heartOutline } from 'ionicons/icons'

const Favorites: React.FC = () => (
  <IonPage>
    <IonHeader translucent>
      <IonToolbar>
        <IonTitle>Favorites</IonTitle>
      </IonToolbar>
    </IonHeader>
    <IonContent fullscreen className="ion-padding">
      <div style={{ textAlign: 'center', paddingTop: '5rem' }}>
        <IonIcon icon={heartOutline} style={{ fontSize: '5rem', color: 'var(--ion-color-step-400)', opacity: 0.5 }} />
        <h2 style={{ color: 'var(--ion-color-step-600)', marginTop: '1.5rem', fontWeight: 600 }}>
          No favorites yet
        </h2>
        <p style={{ color: 'var(--ion-color-step-500)', maxWidth: '280px', margin: '0.5rem auto 0', fontSize: '0.95rem' }}>
          Save your go-to songs and venues here for quick access when you&apos;re ready to sing.
        </p>
      </div>
    </IonContent>
  </IonPage>
)

export default Favorites
