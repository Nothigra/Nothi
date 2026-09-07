import React from 'react';

export const privacyContent = {
  en: (
    <>
      <p className="text-muted mb-xl"><em>Last updated: [DATE TO BE COMPLETED]</em></p>
      
      <div className="legal-alert mb-xl">
        <span>⚠️</span> <span><strong>This document must be reviewed by a lawyer before real publication.</strong></span>
      </div>

      <section>
        <h2>1. Data Controller</h2>
        <p>
          [COMPANY NAME TO BE COMPLETED], a business established in Belgium, company number [BCE NUMBER], is the data controller responsible for processing personal data collected via the Nothi platform.
        </p>
        <p>Privacy contact: [CONTACT EMAIL]</p>
      </section>

      <section>
        <h2>2. Data Collected</h2>
        <table>
          <thead>
            <tr>
              <th>Data</th>
              <th>Purpose</th>
              <th>Legal Basis</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Email, username, avatar (via Google/Discord)</td>
              <td>Account creation and management</td>
              <td>Performance of a contract</td>
            </tr>
            <tr>
              <td>Purchase and sales history</td>
              <td>Transaction management, support</td>
              <td>Performance of a contract</td>
            </tr>
            <tr>
              <td>IP address, connection data</td>
              <td>Security, fraud prevention</td>
              <td>Legitimate interest</td>
            </tr>
            <tr>
              <td>Messages exchanged (buyer-seller chat)</td>
              <td>Facilitating the commercial relationship</td>
              <td>Performance of a contract</td>
            </tr>
            <tr>
              <td>Report content</td>
              <td>Platform moderation</td>
              <td>Legitimate interest</td>
            </tr>
            <tr>
              <td>Payment data</td>
              <td>Processed exclusively by our third-party payment provider — Nothi does not have access to or store this data</td>
              <td>Performance of a contract</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section>
        <h2>3. Data Recipients</h2>
        <p>Your data may be shared with the following subprocessors, strictly for the purpose of operating the Platform:</p>
        <ul>
          <li><strong>Supabase</strong> (database hosting and authentication) — [server location to be specified based on the region chosen]</li>
          <li><strong>Cloudflare</strong> (file/media storage)</li>
          <li><strong>Payment provider</strong> (once integrated) — payment transaction processing</li>
        </ul>
        <p>No data is sold to third parties for commercial purposes.</p>
      </section>

      <section>
        <h2>4. Data Retention</h2>
        <ul>
          <li>Account data: retained as long as the account is active, deleted within [X months] after account deletion.</li>
          <li>Transaction data: retained in accordance with legal accounting record-keeping obligations (generally 7 years in Belgium).</li>
          <li>Messages: retained as long as the conversation is active or per the defined retention policy.</li>
        </ul>
      </section>

      <section>
        <h2>5. Your Rights (GDPR)</h2>
        <p>In accordance with the General Data Protection Regulation, you have the following rights:</p>
        <ul>
          <li><strong>Right of access</strong> to your personal data;</li>
          <li><strong>Right to rectification</strong> in case of inaccurate data;</li>
          <li><strong>Right to erasure</strong> ("right to be forgotten");</li>
          <li><strong>Right to restriction of processing</strong>;</li>
          <li><strong>Right to data portability</strong>;</li>
          <li><strong>Right to object</strong> to processing based on legitimate interest.</li>
        </ul>
        <p>
          To exercise these rights: [CONTACT EMAIL]. You also have the right to lodge a complaint with the Belgian Data Protection Authority (APD/GBA) — <a href="https://www.dataprotectionauthority.be" target="_blank" rel="noreferrer">www.dataprotectionauthority.be</a>.
        </p>
      </section>

      <section>
        <h2>6. Security</h2>
        <p>Nothi implements reasonable technical and organizational measures to protect your data (encrypted sessions, restricted database access via row-level security rules). As no system is entirely foolproof, Nothi cannot guarantee absolute security.</p>
      </section>

      <section>
        <h2>7. Cookies</h2>
        <p>The use of cookies is detailed in our Cookie Policy / consent banner.</p>
      </section>

      <section>
        <h2>8. Changes to This Policy</h2>
        <p>This policy may be updated. Users will be informed of any material changes.</p>
      </section>

      <section>
        <h2>9. Contact</h2>
        <p>[REAL CONTACT EMAIL TO BE COMPLETED]</p>
      </section>
    </>
  ),
  fr: (
    <>
      <p className="text-muted mb-xl"><em>Dernière mise à jour : [DATE À COMPLÉTER]</em></p>
      
      <div className="legal-alert mb-xl">
        <span>⚠️</span> <span><strong>Document à faire relire par un avocat/juriste avant publication réelle.</strong></span>
      </div>

      <section>
        <h2>1. Responsable du traitement</h2>
        <p>
          [RAISON SOCIALE / NOM À COMPLÉTER], entreprise établie en Belgique, numéro d'entreprise [NUMÉRO BCE], est responsable du traitement des données à caractère personnel collectées via la plateforme Nothi.
        </p>
        <p>Contact vie privée : [EMAIL DE CONTACT]</p>
      </section>

      <section>
        <h2>2. Données collectées</h2>
        <table>
          <thead>
            <tr>
              <th>Donnée</th>
              <th>Finalité</th>
              <th>Base légale</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Email, nom d'utilisateur, avatar (via Google/Discord)</td>
              <td>Création et gestion du compte</td>
              <td>Exécution du contrat</td>
            </tr>
            <tr>
              <td>Historique d'achats et de ventes</td>
              <td>Gestion des transactions, support</td>
              <td>Exécution du contrat</td>
            </tr>
            <tr>
              <td>Adresse IP, données de connexion</td>
              <td>Sécurité, prévention de la fraude</td>
              <td>Intérêt légitime</td>
            </tr>
            <tr>
              <td>Messages échangés (chat acheteur-vendeur)</td>
              <td>Faciliter la relation commerciale</td>
              <td>Exécution du contrat</td>
            </tr>
            <tr>
              <td>Contenu des signalements (reports)</td>
              <td>Modération de la plateforme</td>
              <td>Intérêt légitime</td>
            </tr>
            <tr>
              <td>Données de paiement</td>
              <td>Traitées exclusivement par notre prestataire de paiement tiers — Nothi n'y a pas accès et ne les stocke pas</td>
              <td>Exécution du contrat</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section>
        <h2>3. Destinataires des données</h2>
        <p>Vos données peuvent être partagées avec les sous-traitants suivants, strictement dans le cadre du fonctionnement de la Plateforme :</p>
        <ul>
          <li><strong>Supabase</strong> (hébergement base de données et authentification) — [Localisation des serveurs à préciser selon la région choisie]</li>
          <li><strong>Cloudflare</strong> (stockage des fichiers/médias)</li>
          <li><strong>Prestataire de paiement</strong> (une fois intégré) — traitement des transactions financières</li>
        </ul>
        <p>Aucune donnée n'est vendue à des tiers à des fins commerciales.</p>
      </section>

      <section>
        <h2>4. Durée de conservation</h2>
        <ul>
          <li>Données de compte : conservées tant que le compte est actif, supprimées dans un délai de [X mois] après suppression du compte.</li>
          <li>Données de transaction : conservées conformément aux obligations légales de conservation comptable (généralement 7 ans en Belgique).</li>
          <li>Messages : conservés tant que la conversation est active ou selon la politique de rétention définie.</li>
        </ul>
      </section>

      <section>
        <h2>5. Vos droits (RGPD)</h2>
        <p>Conformément au Règlement Général sur la Protection des Données, vous disposez des droits suivants :</p>
        <ul>
          <li><strong>Droit d'accès</strong> à vos données personnelles ;</li>
          <li><strong>Droit de rectification</strong> en cas de données inexactes ;</li>
          <li><strong>Droit à l'effacement</strong> ("droit à l'oubli") ;</li>
          <li><strong>Droit à la limitation du traitement</strong> ;</li>
          <li><strong>Droit à la portabilité</strong> de vos données ;</li>
          <li><strong>Droit d'opposition</strong> au traitement basé sur l'intérêt légitime.</li>
        </ul>
        <p>
          Pour exercer ces droits : [EMAIL DE CONTACT]. Vous disposez également du droit d'introduire une réclamation auprès de l'Autorité de protection des données belge (APD) — <a href="https://www.autoriteprotectiondonnees.be" target="_blank" rel="noreferrer">www.autoriteprotectiondonnees.be</a>.
        </p>
      </section>

      <section>
        <h2>6. Sécurité</h2>
        <p>Nothi met en œuvre des mesures techniques et organisationnelles raisonnables pour protéger vos données (chiffrement des sessions, accès restreint aux bases de données via des règles de sécurité au niveau des lignes). Aucun système n'étant totalement infaillible, Nothi ne peut garantir une sécurité absolue.</p>
      </section>

      <section>
        <h2>7. Cookies</h2>
        <p>L'utilisation de cookies est détaillée dans notre Politique de Cookies / bannière de consentement.</p>
      </section>

      <section>
        <h2>8. Modification de la présente politique</h2>
        <p>Cette politique peut être mise à jour. Les utilisateurs seront informés de toute modification substantielle.</p>
      </section>

      <section>
        <h2>9. Contact</h2>
        <p>[EMAIL DE CONTACT RÉEL À COMPLÉTER]</p>
      </section>
    </>
  ),
  es: (
    <>
      <p className="text-muted mb-xl"><em>Última actualización: [FECHA POR COMPLETAR]</em></p>
      
      <div className="legal-alert mb-xl">
        <span>⚠️</span> <span><strong>Este documento debe ser revisado por un abogado antes de su publicación real.</strong></span>
      </div>

      <section>
        <h2>1. Responsable del Tratamiento</h2>
        <p>
          [NOMBRE DE LA EMPRESA POR COMPLETAR], empresa establecida en Bélgica, número de empresa [NÚMERO BCE], es el responsable del tratamiento de los datos personales recopilados a través de la plataforma Nothi.
        </p>
        <p>Contacto de privacidad: [CORREO DE CONTACTO]</p>
      </section>

      <section>
        <h2>2. Datos Recopilados</h2>
        <table>
          <thead>
            <tr>
              <th>Dato</th>
              <th>Finalidad</th>
              <th>Base Legal</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Email, nombre de usuario, avatar (vía Google/Discord)</td>
              <td>Creación y gestión de la cuenta</td>
              <td>Ejecución de un contrato</td>
            </tr>
            <tr>
              <td>Historial de compras y ventas</td>
              <td>Gestión de transacciones, soporte</td>
              <td>Ejecución de un contrato</td>
            </tr>
            <tr>
              <td>Dirección IP, datos de conexión</td>
              <td>Seguridad, prevención de fraude</td>
              <td>Interés legítimo</td>
            </tr>
            <tr>
              <td>Mensajes intercambiados (chat comprador-vendedor)</td>
              <td>Facilitar la relación comercial</td>
              <td>Ejecución de un contrato</td>
            </tr>
            <tr>
              <td>Contenido de las denuncias</td>
              <td>Moderación de la plataforma</td>
              <td>Interés legítimo</td>
            </tr>
            <tr>
              <td>Datos de pago</td>
              <td>Procesados exclusivamente por nuestro proveedor de pagos externo — Nothi no tiene acceso ni almacena estos datos</td>
              <td>Ejecución de un contrato</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section>
        <h2>3. Destinatarios de los Datos</h2>
        <p>Sus datos pueden compartirse con los siguientes subencargados, estrictamente para el funcionamiento de la Plataforma:</p>
        <ul>
          <li><strong>Supabase</strong> (alojamiento de base de datos y autenticación) — [ubicación de servidores por especificar según la región elegida]</li>
          <li><strong>Cloudflare</strong> (almacenamiento de archivos/medios)</li>
          <li><strong>Proveedor de pagos</strong> (una vez integrado) — procesamiento de transacciones financieras</li>
        </ul>
        <p>Ningún dato se vende a terceros con fines comerciales.</p>
      </section>

      <section>
        <h2>4. Conservación de Datos</h2>
        <ul>
          <li>Datos de cuenta: conservados mientras la cuenta esté activa, eliminados dentro de [X meses] tras la eliminación de la cuenta.</li>
          <li>Datos de transacciones: conservados de acuerdo con las obligaciones legales de conservación contable (generalmente 7 años en Bélgica).</li>
          <li>Mensajes: conservados mientras la conversación esté activa o según la política de retención definida.</li>
        </ul>
      </section>

      <section>
        <h2>5. Sus Derechos (RGPD)</h2>
        <p>De conformidad con el Reglamento General de Protección de Datos, usted tiene los siguientes derechos:</p>
        <ul>
          <li><strong>Derecho de acceso</strong> a sus datos personales;</li>
          <li><strong>Derecho de rectificación</strong> en caso de datos inexactos;</li>
          <li><strong>Derecho de supresión</strong> ("derecho al olvido");</li>
          <li><strong>Derecho a la limitación del tratamiento</strong>;</li>
          <li><strong>Derecho a la portabilidad</strong> de sus datos;</li>
          <li><strong>Derecho de oposición</strong> al tratamiento basado en interés legítimo.</li>
        </ul>
        <p>
          Para ejercer estos derechos: [CORREO DE CONTACTO]. También tiene derecho a presentar una reclamación ante la Autoridad de Protección de Datos belga (APD/GBA) — <a href="https://www.dataprotectionauthority.be" target="_blank" rel="noreferrer">www.dataprotectionauthority.be</a>.
        </p>
      </section>

      <section>
        <h2>6. Seguridad</h2>
        <p>Nothi implementa medidas técnicas y organizativas razonables para proteger sus datos (sesiones cifradas, acceso restringido a las bases de datos mediante reglas de seguridad a nivel de fila). Dado que ningún sistema es totalmente infalible, Nothi no puede garantizar una seguridad absoluta.</p>
      </section>

      <section>
        <h2>7. Cookies</h2>
        <p>El uso de cookies se detalla en nuestra Política de Cookies / banner de consentimiento.</p>
      </section>

      <section>
        <h2>8. Cambios en esta Política</h2>
        <p>Esta política puede actualizarse. Los usuarios serán informados de cualquier cambio sustancial.</p>
      </section>

      <section>
        <h2>9. Contacto</h2>
        <p>[CORREO DE CONTACTO REAL POR COMPLETAR]</p>
      </section>
    </>
  )
};
