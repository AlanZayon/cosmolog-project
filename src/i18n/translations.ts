export type Language = 'pt' | 'en' | 'ja' | 'es';

export const LANGUAGE_LABELS: Record<Language, string> = {
  pt: 'Português',
  en: 'English',
  ja: '日本語',
  es: 'Español',
};

export const LANGUAGE_FLAGS: Record<Language, string> = {
  pt: '🇧🇷',
  en: '🇺🇸',
  ja: '🇯🇵',
  es: '🇪🇸',
};

const translations = {
  // Header
  'header.search': { pt: 'Buscar histórias...', en: 'Search stories...', ja: 'ストーリーを検索...', es: 'Buscar historias...' },
  'header.universes': { pt: 'Universos', en: 'Universes', ja: 'ユニバース', es: 'Universos' },
  'header.write': { pt: 'Escrever', en: 'Write', ja: '書く', es: 'Escribir' },
  'header.login': { pt: 'Entrar', en: 'Sign In', ja: 'ログイン', es: 'Iniciar sesión' },
  'header.signup': { pt: 'Cadastrar', en: 'Sign Up', ja: '新規登録', es: 'Registrarse' },

  // Index
  'index.title.discover': { pt: 'Descubra', en: 'Discover', ja: '発見しよう', es: 'Descubre' },
  'index.title.stories': { pt: 'histórias', en: 'stories', ja: 'ストーリー', es: 'historias' },
  'index.title.amazing': { pt: 'incríveis', en: 'amazing', ja: '素晴らしい', es: 'increíbles' },
  'index.subtitle': {
    pt: 'Leia, escreva e compartilhe contos, livros e quadrinhos com uma comunidade apaixonada por narrativas.',
    en: 'Read, write and share short stories, books and comics with a community passionate about narratives.',
    ja: '物語に情熱を持つコミュニティと共に、短編小説、本、漫画を読み、書き、共有しましょう。',
    es: 'Lee, escribe y comparte cuentos, libros y cómics con una comunidad apasionada por las narrativas.',
  },
  'index.feedBadge': { pt: 'Feed narrativo', en: 'Narrative feed', ja: 'ナラティブフィード', es: 'Feed narrativo' },
  'index.feedSubtitle': {
    pt: 'Histórias para ler agora, arcos para expandir a jornada e universos para explorar sem sair do fluxo.',
    en: 'Stories to read now, arcs to expand the journey, and universes to explore without leaving the flow.',
    ja: '今すぐ読めるストーリー、旅を広げるアーク、流れを止めずに探索できるユニバース。',
    es: 'Historias para leer ahora, arcos para expandir el viaje y universos para explorar sin salir del flujo.',
  },
  'index.feedPillStories': { pt: 'Histórias em destaque primeiro', en: 'Stories first', ja: 'ストーリー優先', es: 'Historias primero' },
  'index.feedPillArcs': { pt: 'Arcos expandem inline', en: 'Arcs expand inline', ja: 'アークはインライン展開', es: 'Arcos expandibles inline' },
  'index.feedPillReader': { pt: 'Leitura sem sair do feed', en: 'Read without leaving the feed', ja: 'フィードを離れずに読む', es: 'Lectura sin salir del feed' },
  'index.allTypes': { pt: 'Todos os Tipos', en: 'All Types', ja: 'すべてのタイプ', es: 'Todos los tipos' },
  'index.allTags': { pt: 'Todas as Tags', en: 'All Tags', ja: 'すべてのタグ', es: 'Todas las etiquetas' },
  'index.mostLiked': { pt: '🔥 Mais Curtidas', en: '🔥 Most Liked', ja: '🔥 人気', es: '🔥 Más gustadas' },
  'index.mostRecent': { pt: '📖 Mais Recentes', en: '📖 Most Recent', ja: '📖 最新', es: '📖 Más recientes' },
  'index.noStories': { pt: 'Nenhuma história encontrada.', en: 'No stories found.', ja: 'ストーリーが見つかりません。', es: 'No se encontraron historias.' },
  'index.loading': { pt: 'Carregando histórias...', en: 'Loading stories...', ja: 'ストーリーを読み込み中...', es: 'Cargando historias...' },

  // Story types
  'type.short_story': { pt: 'Contos', en: 'Short Stories', ja: '短編', es: 'Cuentos' },
  'type.chapters': { pt: 'Capítulos', en: 'Chapters', ja: '章', es: 'Capítulos' },
  'type.comic': { pt: 'Quadrinhos', en: 'Comics', ja: 'コミック', es: 'Cómics' },
  'type.illustrated': { pt: 'Ilustradas', en: 'Illustrated', ja: 'イラスト付き', es: 'Ilustradas' },

  // Story type labels (full)
  'typeLabel.short_story': { pt: 'Conto', en: 'Short Story', ja: '短編小説', es: 'Cuento' },
  'typeLabel.chapters': { pt: 'Livro / Capítulos', en: 'Book / Chapters', ja: '本 / 章', es: 'Libro / Capítulos' },
  'typeLabel.comic': { pt: 'Quadrinho / Mangá', en: 'Comic / Manga', ja: 'コミック / マンガ', es: 'Cómic / Manga' },
  'typeLabel.illustrated': { pt: 'História Ilustrada', en: 'Illustrated Story', ja: 'イラストストーリー', es: 'Historia ilustrada' },

  // Story type descriptions
  'typeDesc.short_story': { pt: 'Texto único, curto ou médio', en: 'Single text, short or medium', ja: '短い、または中程度のテキスト', es: 'Texto único, corto o medio' },
  'typeDesc.chapters': { pt: 'Vários capítulos publicados aos poucos', en: 'Multiple chapters published over time', ja: '少しずつ公開される複数の章', es: 'Varios capítulos publicados poco a poco' },
  'typeDesc.comic': { pt: 'Páginas com imagens em sequência', en: 'Sequential image pages', ja: '連続した画像ページ', es: 'Páginas con imágenes en secuencia' },
  'typeDesc.illustrated': { pt: 'Texto e imagens intercaladas', en: 'Interspersed text and images', ja: 'テキストと画像の交互構成', es: 'Texto e imágenes intercaladas' },

  // Common
  'common.by': { pt: 'por', en: 'by', ja: '著者:', es: 'por' },
  'common.anonymous': { pt: 'Anônimo', en: 'Anonymous', ja: '匿名', es: 'Anónimo' },
  'common.save': { pt: 'Salvar', en: 'Save', ja: '保存', es: 'Guardar' },
  'common.cancel': { pt: 'Cancelar', en: 'Cancel', ja: 'キャンセル', es: 'Cancelar' },
  'common.edit': { pt: 'Editar', en: 'Edit', ja: '編集', es: 'Editar' },
  'common.saving': { pt: 'Salvando...', en: 'Saving...', ja: '保存中...', es: 'Guardando...' },
  'common.loading': { pt: 'Carregando...', en: 'Loading...', ja: '読み込み中...', es: 'Cargando...' },
  'common.error': { pt: 'Erro', en: 'Error', ja: 'エラー', es: 'Error' },
  'common.send': { pt: 'Enviar', en: 'Send', ja: '送信', es: 'Enviar' },
  'common.back': { pt: '← Voltar', en: '← Back', ja: '← 戻る', es: '← Volver' },
  'common.all': { pt: 'Todos', en: 'All', ja: 'すべて', es: 'Todos' },
  'common.previous': { pt: 'Anterior', en: 'Previous', ja: '前へ', es: 'Anterior' },
  'common.next': { pt: 'Próximo', en: 'Next', ja: '次へ', es: 'Siguiente' },
  'common.add': { pt: 'Adicionar', en: 'Add', ja: '追加', es: 'Añadir' },
  'common.creating': { pt: 'Criando...', en: 'Creating...', ja: '作成中...', es: 'Creando...' },
  'common.noContent': { pt: 'Sem conteúdo.', en: 'No content.', ja: 'コンテンツなし。', es: 'Sin contenido.' },
  'common.none': { pt: 'Nenhum', en: 'None', ja: 'なし', es: 'Ninguno' },
  'common.delete': { pt: 'Excluir', en: 'Delete', ja: '削除', es: 'Eliminar' },

  // Login
  'login.welcome': { pt: 'Bem-vindo de volta', en: 'Welcome back', ja: 'おかえりなさい', es: 'Bienvenido de nuevo' },
  'login.subtitle': { pt: 'Entre na sua conta', en: 'Sign in to your account', ja: 'アカウントにログイン', es: 'Inicia sesión en tu cuenta' },
  'login.email': { pt: 'Email', en: 'Email', ja: 'メール', es: 'Correo electrónico' },
  'login.password': { pt: 'Senha', en: 'Password', ja: 'パスワード', es: 'Contraseña' },
  'login.submit': { pt: 'Entrar', en: 'Sign In', ja: 'ログイン', es: 'Iniciar sesión' },
  'login.submitting': { pt: 'Entrando...', en: 'Signing in...', ja: 'ログイン中...', es: 'Iniciando sesión...' },
  'login.noAccount': { pt: 'Não tem conta?', en: "Don't have an account?", ja: 'アカウントをお持ちでないですか？', es: '¿No tienes cuenta?' },
  'login.signupLink': { pt: 'Cadastre-se', en: 'Sign up', ja: '新規登録', es: 'Regístrate' },
  'login.error': { pt: 'Erro ao entrar', en: 'Sign in error', ja: 'ログインエラー', es: 'Error al iniciar sesión' },

  // Signup
  'signup.title': { pt: 'Crie sua conta', en: 'Create your account', ja: 'アカウントを作成', es: 'Crea tu cuenta' },
  'signup.subtitle': { pt: 'Comece a compartilhar suas histórias', en: 'Start sharing your stories', ja: 'ストーリーの共有を始めましょう', es: 'Empieza a compartir tus historias' },
  'signup.username': { pt: 'Nome de usuário', en: 'Username', ja: 'ユーザー名', es: 'Nombre de usuario' },
  'signup.password': { pt: 'Senha (mín. 6 caracteres)', en: 'Password (min. 6 chars)', ja: 'パスワード（6文字以上）', es: 'Contraseña (mín. 6 caracteres)' },
  'signup.submit': { pt: 'Cadastrar', en: 'Sign Up', ja: '登録', es: 'Registrarse' },
  'signup.submitting': { pt: 'Criando...', en: 'Creating...', ja: '作成中...', es: 'Creando...' },
  'signup.hasAccount': { pt: 'Já tem conta?', en: 'Already have an account?', ja: 'すでにアカウントをお持ちですか？', es: '¿Ya tienes cuenta?' },
  'signup.loginLink': { pt: 'Entrar', en: 'Sign in', ja: 'ログイン', es: 'Iniciar sesión' },
  'signup.success': { pt: 'Conta criada!', en: 'Account created!', ja: 'アカウントが作成されました！', es: '¡Cuenta creada!' },
  'signup.confirmEmail': { pt: 'Verifique seu email para confirmar.', en: 'Check your email to confirm.', ja: 'メールを確認してください。', es: 'Verifica tu correo para confirmar.' },
  'signup.error': { pt: 'Erro ao cadastrar', en: 'Sign up error', ja: '登録エラー', es: 'Error al registrarse' },

  // Profile
  'profile.myStories': { pt: 'Minhas Histórias', en: 'My Stories', ja: 'マイストーリー', es: 'Mis historias' },
  'profile.noStories': { pt: 'Você ainda não publicou nenhuma história.', en: "You haven't published any stories yet.", ja: 'まだストーリーを公開していません。', es: 'Aún no has publicado ninguna historia.' },
  'profile.myUniverses': { pt: 'Meus Universos', en: 'My Universes', ja: 'マイユニバース', es: 'Mis universos' },
  'profile.noUniverses': { pt: 'Você ainda não criou nenhum universo.', en: "You haven't created any universes yet.", ja: 'まだユニバースを作成していません。', es: 'Aún no has creado ningún universo.' },
  'profile.editProfile': { pt: 'Editar perfil', en: 'Edit profile', ja: 'プロフィール編集', es: 'Editar perfil' },
  'profile.noBio': { pt: 'Sem bio ainda', en: 'No bio yet', ja: 'まだ自己紹介がありません', es: 'Sin biografía aún' },
  'profile.usernamePlaceholder': { pt: 'Nome de usuário', en: 'Username', ja: 'ユーザー名', es: 'Nombre de usuario' },
  'profile.bioPlaceholder': { pt: 'Bio curta...', en: 'Short bio...', ja: '短い自己紹介...', es: 'Biografía corta...' },
  'profile.updated': { pt: 'Perfil atualizado!', en: 'Profile updated!', ja: 'プロフィールが更新されました！', es: '¡Perfil actualizado!' },
  'profile.avatarUpdated': { pt: 'Avatar atualizado!', en: 'Avatar updated!', ja: 'アバターが更新されました！', es: '¡Avatar actualizado!' },
  'profile.imageTooLarge': { pt: 'Imagem muito grande', en: 'Image too large', ja: '画像が大きすぎます', es: 'Imagen demasiado grande' },
  'profile.max2mb': { pt: 'Máximo 2MB', en: 'Max 2MB', ja: '最大2MB', es: 'Máximo 2MB' },

  // Search
  'search.resultsFor': { pt: 'Resultados para', en: 'Results for', ja: '検索結果:', es: 'Resultados para' },
  'search.searching': { pt: 'Buscando...', en: 'Searching...', ja: '検索中...', es: 'Buscando...' },
  'search.noResults': { pt: 'Nenhuma história encontrada.', en: 'No stories found.', ja: 'ストーリーが見つかりません。', es: 'No se encontraron historias.' },

  // Universes
  'universes.title': { pt: 'Meus Universos', en: 'My Universes', ja: 'マイユニバース', es: 'Mis universos' },
  'universes.new': { pt: 'Novo Universo', en: 'New Universe', ja: '新しいユニバース', es: 'Nuevo universo' },
  'universes.empty': { pt: 'Você ainda não criou nenhum universo.', en: "You haven't created any universes yet.", ja: 'まだユニバースを作成していません。', es: 'Aún no has creado ningún universo.' },
  'universes.createFirst': { pt: 'Criar meu primeiro universo', en: 'Create my first universe', ja: '最初のユニバースを作成', es: 'Crear mi primer universo' },

  // Create Universe
  'createUniverse.title': { pt: 'Novo Universo', en: 'New Universe', ja: '新しいユニバース', es: 'Nuevo universo' },
  'createUniverse.cover': { pt: 'Capa', en: 'Cover', ja: 'カバー', es: 'Portada' },
  'createUniverse.addCover': { pt: 'Adicionar capa', en: 'Add cover', ja: 'カバーを追加', es: 'Añadir portada' },
  'createUniverse.nameLabel': { pt: 'Título', en: 'Title', ja: 'タイトル', es: 'Título' },
  'createUniverse.namePlaceholder': { pt: 'Nome do universo', en: 'Universe name', ja: 'ユニバース名', es: 'Nombre del universo' },
  'createUniverse.descLabel': { pt: 'Descrição', en: 'Description', ja: '説明', es: 'Descripción' },
  'createUniverse.descPlaceholder': { pt: 'Descreva o universo das suas histórias...', en: 'Describe the universe of your stories...', ja: 'ストーリーのユニバースを説明してください...', es: 'Describe el universo de tus historias...' },
  'createUniverse.submit': { pt: 'Criar Universo', en: 'Create Universe', ja: 'ユニバースを作成', es: 'Crear universo' },
  'createUniverse.success': { pt: 'Universo criado!', en: 'Universe created!', ja: 'ユニバースが作成されました！', es: '¡Universo creado!' },

  // Universe page
  'universe.stories': { pt: 'Histórias', en: 'Stories', ja: 'ストーリー', es: 'Historias' },
  'universe.arcs': { pt: 'Arcos', en: 'Arcs', ja: 'アーク', es: 'Arcos' },
  'universe.newArc': { pt: 'Novo Arco', en: 'New Arc', ja: '新しいアーク', es: 'Nuevo arco' },
  'universe.editArc': { pt: 'Editar Arco', en: 'Edit Arc', ja: 'アークを編集', es: 'Editar arco' },
  'universe.arcName': { pt: 'Nome do arco', en: 'Arc name', ja: 'アーク名', es: 'Nombre del arco' },
  'universe.arcDescription': { pt: 'Descrição do arco', en: 'Arc description', ja: 'アークの説明', es: 'Descripción del arco' },
  'universe.arcType': { pt: 'Tipo do arco', en: 'Arc type', ja: 'アークの種類', es: 'Tipo de arco' },
  'universe.arcCover': { pt: 'Capa do arco', en: 'Arc cover', ja: 'アークのカバー', es: 'Portada del arco' },
  'universe.addArcCover': { pt: 'Adicionar capa do arco', en: 'Add arc cover', ja: 'アークのカバーを追加', es: 'Añadir portada del arco' },
  'universe.arcCreated': { pt: 'Arco criado!', en: 'Arc created!', ja: 'アークが作成されました！', es: '¡Arco creado!' },
  'universe.arcUpdated': { pt: 'Arco atualizado!', en: 'Arc updated!', ja: 'アークが更新されました！', es: '¡Arco actualizado!' },
  'universe.arcDeleted': { pt: 'Arco excluído!', en: 'Arc deleted!', ja: 'アークが削除されました！', es: '¡Arco eliminado!' },
  'universe.noArcs': { pt: 'Nenhum arco criado neste universo ainda.', en: 'No arcs in this universe yet.', ja: 'このユニバースにはまだアークがありません。', es: 'Aún no hay arcos en este universo.' },
  'universe.storiesWithoutArc': { pt: 'Histórias sem arco', en: 'Stories without arc', ja: 'アークのないストーリー', es: 'Historias sin arco' },
  'universe.noStoriesWithoutArc': { pt: 'Todas as histórias deste universo já estão em arcos.', en: 'All stories in this universe already belong to arcs.', ja: 'このユニバースのすべてのストーリーはすでにアークに属しています。', es: 'Todas las historias de este universo ya pertenecen a arcos.' },
  'universe.arcStoriesEmpty': { pt: 'Nenhuma história neste arco ainda.', en: 'No stories in this arc yet.', ja: 'このアークにはまだストーリーがありません。', es: 'Aún no hay historias en este arco.' },
  'universe.deleteArcConfirm': { pt: 'Excluir este arco? As histórias continuarão no universo, mas ficarão sem arco.', en: 'Delete this arc? Stories will stay in the universe but become unassigned.', ja: 'このアークを削除しますか？ ストーリーはユニバースに残りますが、未割り当てになります。', es: '¿Eliminar este arco? Las historias seguirán en el universo pero quedarán sin arco.' },
  'arcType.character': { pt: 'Personagem', en: 'Character', ja: 'キャラクター', es: 'Personaje' },
  'arcType.era': { pt: 'Era', en: 'Era', ja: '時代', es: 'Era' },
  'arcType.planet': { pt: 'Planeta', en: 'Planet', ja: '惑星', es: 'Planeta' },
  'arcType.event': { pt: 'Evento', en: 'Event', ja: 'イベント', es: 'Evento' },
  'arcType.custom': { pt: 'Personalizado', en: 'Custom', ja: 'カスタム', es: 'Personalizado' },
  'universe.newStory': { pt: 'Nova História', en: 'New Story', ja: '新しいストーリー', es: 'Nueva historia' },
  'universe.follow': { pt: 'Seguir universo', en: 'Follow universe', ja: 'ユニバースをフォロー', es: 'Seguir universo' },
  'universe.unfollow': { pt: 'Deixar de seguir', en: 'Unfollow', ja: 'フォロー解除', es: 'Dejar de seguir' },
  'universe.noStories': { pt: 'Nenhuma história neste universo ainda.', en: 'No stories in this universe yet.', ja: 'このユニバースにはまだストーリーがありません。', es: 'Aún no hay historias en este universo.' },
  'universe.createFirst': { pt: 'Criar primeira história', en: 'Create first story', ja: '最初のストーリーを作成', es: 'Crear primera historia' },
  'universe.notFound': { pt: 'Universo não encontrado.', en: 'Universe not found.', ja: 'ユニバースが見つかりません。', es: 'Universo no encontrado.' },
  'universe.editUniverse': { pt: 'Editar Universo', en: 'Edit Universe', ja: 'ユニバースを編集', es: 'Editar universo' },
  'universe.updated': { pt: 'Universo atualizado!', en: 'Universe updated!', ja: 'ユニバースが更新されました！', es: '¡Universo actualizado!' },

  // Story page
  'story.editStory': { pt: 'Editar História', en: 'Edit Story', ja: 'ストーリーを編集', es: 'Editar historia' },
  'story.editContent': { pt: 'Editar conteúdo', en: 'Edit content', ja: 'コンテンツを編集', es: 'Editar contenido' },
  'story.editPages': { pt: 'Editar páginas', en: 'Edit pages', ja: 'ページを編集', es: 'Editar páginas' },
  'story.editBlocks': { pt: 'Editar blocos', en: 'Edit blocks', ja: 'ブロックを編集', es: 'Editar bloques' },
  'story.chapters': { pt: 'Capítulos', en: 'Chapters', ja: '章', es: 'Capítulos' },
  'story.pages': { pt: 'Páginas', en: 'Pages', ja: 'ページ', es: 'Páginas' },
  'story.comments': { pt: 'Comentários', en: 'Comments', ja: 'コメント', es: 'Comentarios' },
  'story.noComments': { pt: 'Nenhum comentário ainda.', en: 'No comments yet.', ja: 'まだコメントがありません。', es: 'Aún no hay comentarios.' },
  'story.commentPlaceholder': { pt: 'Escreva um comentário...', en: 'Write a comment...', ja: 'コメントを書く...', es: 'Escribe un comentario...' },
  'story.noChapters': { pt: 'Nenhum capítulo ainda.', en: 'No chapters yet.', ja: 'まだ章がありません。', es: 'Aún no hay capítulos.' },
  'story.noPages': { pt: 'Nenhuma página ainda.', en: 'No pages yet.', ja: 'まだページがありません。', es: 'Aún no hay páginas.' },
  'story.chapterTitlePlaceholder': { pt: 'Título do capítulo', en: 'Chapter title', ja: '章のタイトル', es: 'Título del capítulo' },
  'story.chapterContentPlaceholder': { pt: 'Conteúdo do capítulo...', en: 'Chapter content...', ja: '章の内容...', es: 'Contenido del capítulo...' },
  'story.saveChapter': { pt: 'Salvar Capítulo', en: 'Save Chapter', ja: '章を保存', es: 'Guardar capítulo' },
  'story.updated': { pt: 'História atualizada!', en: 'Story updated!', ja: 'ストーリーが更新されました！', es: '¡Historia actualizada!' },
  'story.contentUpdated': { pt: 'Conteúdo atualizado!', en: 'Content updated!', ja: 'コンテンツが更新されました！', es: '¡Contenido actualizado!' },
  'story.loginToLike': { pt: 'Entre para curtir', en: 'Sign in to like', ja: 'いいねするにはログインしてください', es: 'Inicia sesión para dar like' },
  'story.cover': { pt: 'Capa', en: 'Cover', ja: 'カバー', es: 'Portada' },
  'story.title': { pt: 'Título', en: 'Title', ja: 'タイトル', es: 'Título' },
  'story.description': { pt: 'Descrição', en: 'Description', ja: '説明', es: 'Descripción' },
  'story.universe': { pt: 'Universo', en: 'Universe', ja: 'ユニバース', es: 'Universo' },
  'story.arc': { pt: 'Arco', en: 'Arc', ja: 'アーク', es: 'Arco' },
  'story.tags': { pt: 'Tags (até 5)', en: 'Tags (up to 5)', ja: 'タグ（最大5つ）', es: 'Etiquetas (hasta 5)' },
  'story.imageTooLarge': { pt: 'Imagem muito grande', en: 'Image too large', ja: '画像が大きすぎます', es: 'Imagen demasiado grande' },
  'story.max5mb': { pt: 'Máximo 5MB', en: 'Max 5MB', ja: '最大5MB', es: 'Máximo 5MB' },
  'story.addCover': { pt: 'Adicionar capa', en: 'Add cover', ja: 'カバーを追加', es: 'Añadir portada' },
  'story.page': { pt: 'Página', en: 'Page', ja: 'ページ', es: 'Página' },
  'story.illustration': { pt: 'Ilustração', en: 'Illustration', ja: 'イラスト', es: 'Ilustración' },
  'story.readNow': { pt: 'Ler agora', en: 'Read now', ja: '今すぐ読む', es: 'Leer ahora' },
  'story.openFullPage': { pt: 'Abrir página completa', en: 'Open full page', ja: '全ページを開く', es: 'Abrir página completa' },

  // Create story
  'createStory.title': { pt: 'Nova História', en: 'New Story', ja: '新しいストーリー', es: 'Nueva historia' },
  'createStory.chooseType': { pt: 'Escolha o tipo de história:', en: 'Choose the story type:', ja: 'ストーリーのタイプを選択:', es: 'Elige el tipo de historia:' },
  'createStory.universeRequired': { pt: 'Escolha um universo para publicar esta história.', en: 'Choose a universe for this story.', ja: 'このストーリーのユニバースを選択してください。', es: 'Elige un universo para esta historia.' },
  'createStory.noUniverses': { pt: 'Você precisa criar um universo antes de publicar uma história.', en: 'You need to create a universe before publishing a story.', ja: 'ストーリーを公開する前にユニバースを作成する必要があります。', es: 'Necesitas crear un universo antes de publicar una historia.' },
  'createStory.createUniverseFirst': { pt: 'Criar universo primeiro', en: 'Create universe first', ja: 'まずユニバースを作成', es: 'Crear universo primero' },
  'createStory.titlePlaceholder': { pt: 'Título da história', en: 'Story title', ja: 'ストーリーのタイトル', es: 'Título de la historia' },
  'createStory.descPlaceholder': { pt: 'Uma breve descrição...', en: 'A brief description...', ja: '簡単な説明...', es: 'Una breve descripción...' },
  'createStory.contentLabel': { pt: 'Conteúdo', en: 'Content', ja: 'コンテンツ', es: 'Contenido' },
  'createStory.contentPlaceholder': { pt: 'Escreva seu conto aqui...', en: 'Write your story here...', ja: 'ここにストーリーを書いてください...', es: 'Escribe tu cuento aquí...' },
  'createStory.chaptersHint': { pt: '📖 Após criar a história, você poderá adicionar capítulos na página da história.', en: '📖 After creating the story, you can add chapters on the story page.', ja: '📖 ストーリーを作成した後、ストーリーページで章を追加できます。', es: '📖 Después de crear la historia, podrás añadir capítulos en la página de la historia.' },
  'createStory.pagesLabel': { pt: 'Páginas', en: 'Pages', ja: 'ページ', es: 'Páginas' },
  'createStory.blocksLabel': { pt: 'Blocos de Conteúdo', en: 'Content Blocks', ja: 'コンテンツブロック', es: 'Bloques de contenido' },
  'createStory.submit': { pt: 'Criar História', en: 'Create Story', ja: 'ストーリーを作成', es: 'Crear historia' },
  'createStory.success': { pt: 'História criada!', en: 'Story created!', ja: 'ストーリーが作成されました！', es: '¡Historia creada!' },

  // Feed / Arc
  'feed.exploreArc': { pt: 'Explorar Arco', en: 'Explore Arc', ja: 'アークを見る', es: 'Explorar arco' },

  // Chapter page
  'chapter.backToStory': { pt: '← Voltar à história', en: '← Back to story', ja: '← ストーリーに戻る', es: '← Volver a la historia' },
  'chapter.updated': { pt: 'Capítulo atualizado!', en: 'Chapter updated!', ja: '章が更新されました！', es: '¡Capítulo actualizado!' },
  'chapter.saveError': { pt: 'Erro ao salvar', en: 'Save error', ja: '保存エラー', es: 'Error al guardar' },

  // Not found
  'notFound.title': { pt: 'Página não encontrada', en: 'Page not found', ja: 'ページが見つかりません', es: 'Página no encontrada' },
  'notFound.link': { pt: 'Voltar ao início', en: 'Return to Home', ja: 'ホームに戻る', es: 'Volver al inicio' },

  // Components
  'comic.addPages': { pt: 'Adicionar Páginas', en: 'Add Pages', ja: 'ページを追加', es: 'Añadir páginas' },
  'illustrated.text': { pt: 'Texto', en: 'Text', ja: 'テキスト', es: 'Texto' },
  'illustrated.image': { pt: 'Imagem', en: 'Image', ja: '画像', es: 'Imagen' },
  'illustrated.writePlaceholder': { pt: 'Escreva o texto...', en: 'Write the text...', ja: 'テキストを書いてください...', es: 'Escribe el texto...' },
  'tagInput.placeholder': { pt: 'Digite uma tag e pressione Enter', en: 'Type a tag and press Enter', ja: 'タグを入力してEnterを押してください', es: 'Escribe una etiqueta y presiona Enter' },
} as const;

export type TranslationKey = keyof typeof translations;

export function getTranslation(key: TranslationKey, lang: Language): string {
  return translations[key]?.[lang] || translations[key]?.['pt'] || key;
}

export default translations;
