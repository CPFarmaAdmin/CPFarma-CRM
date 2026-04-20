-- ================================================================
-- Plantillas de email CP Farma — ejecutar en Supabase SQL Editor
-- ================================================================

INSERT INTO templates (name, subject, body, position) VALUES

('1 · Primer contacto (solicitud datos)',
 'Solicitud de contacto - Servicio de Farmacia',
 'Estimados/as,

Me dirijo a ustedes para presentar Galenic Plus, un programa especializado en la gestión de farmacotecnia y formulación en farmacia hospitalaria, actualmente implantado en 34 hospitales.

Les agradeceríamos nos faciliten el nombre y correo electrónico de la persona responsable de la Dirección o Servicio de Farmacia de su centro, a fin de remitirle información específica.

Si esta no fuera la vía adecuada de comunicación, rogamos nos indiquen el canal correcto. Asimismo, si desean que eliminemos sus datos conforme a la normativa de protección de datos, pueden comunicárnoslo respondiendo a este mensaje.

Gracias por su atención.

Atentamente,
CP Farma',
1),

('2 · Presentación del programa',
 'Presentación Galenic Plus — Software de Farmacotecnia Hospitalaria',
 'Buenos días [Name],

En primer lugar, queremos agradecerle la oportunidad de presentarle nuestra empresa y nuestros programas. CP Farma es una empresa especializada en el desarrollo de programas informáticos para farmacia hospitalaria.

Nuestro programa Galenic Plus está actualmente implantado en 34 hospitales, tanto públicos como privados, entre ellos: Hospital Universitario La Paz, Hospital Puerta de Hierro, Hospital Virgen de la Arrixaca, hospitales de Albacete, Guadalajara y San Sebastián de los Reyes, además de 12 hospitales en la Comunidad Valenciana y 9 en la Comunidad de Madrid.

Le adjuntamos un breve resumen de las principales funciones del programa. Si consideran que puede resultar de interés para su servicio, estaríamos encantados de concertar una conexión vía Teams para realizar una presentación más detallada.

Quedamos a su disposición.

Reciba un cordial saludo,
CP Farma',
2),

('3 · Follow-up 1 (sin respuesta 2 semanas)',
 'Seguimiento — Galenic Plus',
 'Buenos días [Name],

Le escribimos para hacer seguimiento del correo que le enviamos hace unos días con información sobre nuestro programa Galenic Plus para farmacotecnia hospitalaria.

¿Ha tenido oportunidad de revisarlo? Si tiene alguna duda o quiere que le ampliemos información, estamos a su disposición.

Estaríamos encantados de concertar una breve llamada o demostración vía Teams cuando le venga bien.

Un cordial saludo,
CP Farma',
3),

('4 · Follow-up 2 (1 mes, propone demo)',
 'Galenic Plus — ¿Podemos agendar una demo?',
 'Buenos días [Name],

S� que el tiempo es escaso en un servicio de farmacia hospitalaria, por eso quiero ser breve.

Galenic Plus lleva más de 10 años ayudando a servicios de farmacia como el suyo a mejorar la gestión de farmacotecnia. En 30 minutos por Teams podría ver si encaja con las necesidades de su centro, sin compromiso.

¿Tendría disponibilidad esta semana o la próxima?

Quedo a su disposición,
CP Farma',
4),

('5 · Confirmación de demo',
 'Confirmación demo Galenic Plus',
 'Buenos días [Name],

Quedamos confirmados para la demostración de Galenic Plus el próximo [FECHA] a las [HORA] vía Teams.

Enlace Teams: [ENLACE]

En la sesión le mostraremos:
- Gestión de fórmulas magistrales y preparados
- Trazabilidad completa del proceso
- Integración con sistemas hospitalarios
- Módulo de control de caducidades

Si necesita cambiar la fecha o tiene alguna pregunta previa, no dude en escribirnos.

¡Hasta pronto!
CP Farma',
5),

('6 · Envío de presupuesto',
 'Propuesta económica Galenic Plus',
 'Buenos días [Name],

Ha sido un placer presentarle Galenic Plus. Tal y como acordamos, le adjuntamos nuestra propuesta económica adaptada a las necesidades de su centro.

La propuesta incluye:
- Licencia del software Galenic Plus
- Instalación y configuración
- Formación del equipo (presencial o por Teams)
- Soporte técnico durante el primer año

Quedamos a su disposición para resolver cualquier duda o para ajustar la propuesta si es necesario.

Un cordial saludo,
CP Farma',
6),

('7 · Follow-up post-presupuesto',
 'Seguimiento propuesta Galenic Plus',
 'Buenos días [Name],

Le escribimos para hacer seguimiento de la propuesta que le enviamos para Galenic Plus.

Sabemos que en un hospital público el proceso de aprobación implica varios departamentos (Farmacia, Informática, Gerencia) y puede llevar tiempo. Estamos a su disposición para facilitar la información que necesite cada departamento, reunirnos con quien sea necesario o ajustar cualquier aspecto de la propuesta.

¿Cómo está evolucionando el proceso de valoración?

Gracias por su tiempo,
CP Farma',
7),

('8 · Clientes — Actualización de versión',
 'Actualización Galenic Plus — Nueva versión disponible',
 'Buenos días [Name],

Le comunicamos que está disponible la nueva versión de Galenic Plus con las siguientes mejoras:

[DESCRIBIR MEJORAS]

Para proceder con la actualización necesitaremos coordinar con el departamento de Informática la ventana de mantenimiento. ¿Cuándo sería un buen momento?

Quedamos a su disposición,
CP Farma — Soporte técnico',
8);
